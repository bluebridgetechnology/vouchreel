import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events, spaces } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * POST /api/events
 * Batched event ingestion endpoint for the embed widget.
 * Accepts analytics beacons, validates space ownership, enforces rate limiting,
 * and records events into the database.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    const text = await request.text();
    if (!text) {
      return NextResponse.json(
        { error: "Request body cannot be empty" },
        { status: 400, headers: corsHeaders }
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400, headers: corsHeaders }
    );
  }

  const parsed = eventsPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: corsHeaders }
    );
  }

  const { events: eventList } = parsed.data;

  // Derive rate limit identifier (sessionId or IP fallback)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  // Check rate limit per session (or IP if no session provided)
  const sessionIds = new Set(
    eventList.map((e) => e.sessionId).filter(Boolean) as string[]
  );
  const identifiers = sessionIds.size > 0 ? Array.from(sessionIds) : [ip];

  for (const id of identifiers) {
    const limit = rateLimit(`events_${id}`, {
      windowMs: 10 * 60 * 1000, // 10 minutes
      max: 100, // max 100 events per session per 10 minutes
    });

    if (!limit.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Maximum 100 events per 10 minutes.",
          reset: limit.reset,
        },
        {
          status: 429,
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
      return NextResponse.json(
        { error: `Space not found: ${spaceId}` },
        { status: 404, headers: corsHeaders }
      );
    }
  }

  try {
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
        testimonialId: evt.testimonialId || null,
        sessionId: evt.sessionId || null,
        eventType: evt.eventType,
        pageUrl: evt.pageUrl || null,
        timestamp: parsedTimestamp,
        metadata: evt.metadata || null,
      };
    });

    await db.insert(events).values(insertValues);

    return NextResponse.json(
      { success: true, count: insertValues.length },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to insert events:", error);
    return NextResponse.json(
      { error: "Failed to store events" },
      { status: 500, headers: corsHeaders }
    );
  }
}
