import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events, spaces, testimonials } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import {
  apiError,
  badRequest,
  validationError,
  notFound,
  internalError,
} from "@/lib/api/errors";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { getClientIp } from "@/lib/security/client-ip";
import { log } from "@/lib/log";

// navigator.sendBeacon sends cross-origin requests with credentials mode "include",
// for which browsers reject `Access-Control-Allow-Origin: *`. Reflect the request
// origin (embeds run on arbitrary customer domains, so there is no allowlist).
function corsHeadersFor(request: Request): Record<string, string> {
  const base = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  const origin = request.headers.get("origin");
  if (!origin) {
    return { "Access-Control-Allow-Origin": "*", ...base };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
    ...base,
  };
}

const uuidRegex =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const eventItemSchema = z.object({
  spaceId: z.string().regex(uuidRegex, "Invalid space ID"),
  testimonialId: z
    .string()
    .regex(uuidRegex, "Invalid testimonial ID")
    .optional()
    .nullable(),
  sessionId: z.string().optional().nullable(),
  eventType: z.enum(["impression", "play", "click", "convert"]),
  pageUrl: z.string().optional().nullable(),
  timestamp: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const eventsPayloadSchema = z.object({
  events: z
    .array(eventItemSchema)
    .min(1, "At least one event is required")
    .max(100, "Maximum 100 events per batch"),
});

/**
 * OPTIONS /api/events
 * Preflight handler for CORS.
 */
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeadersFor(request),
  });
}

/**
 * POST /api/events
 * Batched event ingestion endpoint for the embed widget.
 * Accepts analytics beacons, validates space ownership, enforces rate limiting,
 * and records events into the database.
 */
export async function POST(request: Request) {
  const corsHeaders = corsHeadersFor(request);
  let body: unknown;
  try {
    const text = await request.text();
    if (!text) {
      return badRequest("Request body cannot be empty", corsHeaders);
    }
    body = JSON.parse(text);
  } catch {
    return badRequest("Invalid JSON payload", corsHeaders);
  }

  const parsed = eventsPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(
      "Validation failed",
      parsed.error.flatten().fieldErrors,
      corsHeaders
    );
  }

  const { events: eventList } = parsed.data;

  const ip = getClientIp(request.headers);

  // Check rate limit per session (or IP if no session provided)
  const sessionIds = new Set(
    eventList.map((e) => e.sessionId).filter(Boolean) as string[]
  );
  // Limit per client-supplied session AND per IP: sessionIds are free to invent, so a
  // session-only limit can be bypassed by rotating them.
  const identifiers = [...Array.from(sessionIds).map((id) => `events_${id}`), `events_ip_${ip}`];

  for (const id of identifiers) {
    const isIpBucket = id.startsWith("events_ip_");
    const limit = await rateLimit(id, {
      windowMs: 10 * 60 * 1000, // 10 minutes
      max: isIpBucket ? 1000 : 100, // per session: 100 events; per IP: 1000 events
    });

    if (!limit.success) {
      return apiError(
        429,
        "RATE_LIMITED",
        "Rate limit exceeded. Maximum 100 events per 10 minutes.",
        {
          details: { reset: limit.reset },
          headers: {
            ...corsHeaders,
            "Retry-After": Math.ceil((limit.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
  }

  // Validate that all referenced spaces exist
  const uniqueSpaceIds = Array.from(new Set(eventList.map((e) => e.spaceId)));
  for (const spaceId of uniqueSpaceIds) {
    const [space] = await db
      .select({ id: spaces.id })
      .from(spaces)
      .where(eq(spaces.id, spaceId));

    if (!space) {
      return notFound(`Space not found: ${spaceId}`, corsHeaders);
    }
  }

  try {
    // The widget also shows made videos, whose ids are not testimonials. An event naming an id that is not a
    // testimonial keeps counting for the space, instead of failing the whole batch on the foreign key.
    const named = Array.from(new Set(eventList.map((e) => e.testimonialId).filter((id): id is string => Boolean(id))));
    const known = new Set<string>();
    if (named.length > 0) {
      const rows = await db.select({ id: testimonials.id }).from(testimonials).where(inArray(testimonials.id, named));
      for (const row of rows ?? []) known.add(row.id);
    }

    const insertValues = eventList.map((evt) => {
      let parsedTimestamp = new Date();
      if (evt.timestamp) {
        const d = new Date(evt.timestamp);
        if (!isNaN(d.getTime())) {
          parsedTimestamp = d;
        }
      }

      return {
        spaceId: evt.spaceId,
        testimonialId: evt.testimonialId && known.has(evt.testimonialId) ? evt.testimonialId : null,
        sessionId: evt.sessionId || null,
        eventType: evt.eventType,
        pageUrl: evt.pageUrl || null,
        timestamp: parsedTimestamp,
        metadata: evt.metadata || null,
      };
    });

    await db.insert(events).values(insertValues);

    // Dispatch webhook for conversions (non-blocking)
    for (const evt of insertValues) {
      if (evt.eventType === "convert") {
        dispatchWebhookEvent({
          event: "conversion.tracked",
          spaceId: evt.spaceId,
          payload: { event: evt },
        }).catch(() => {});
      }
    }

    return NextResponse.json(
      { success: true, count: insertValues.length },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    log.error("Failed to insert events:", error);
    return internalError("Failed to store events", corsHeaders);
  }
}
