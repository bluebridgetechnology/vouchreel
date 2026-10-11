import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { apiError, badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { runInstallCheck } from "@/lib/install/check";
import { log } from "@/lib/log";
import { rateLimit } from "@/lib/rate-limit";
import { layoutInfo } from "@/lib/widget-editor/layouts";
import { getWidget } from "@/lib/widgets/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  url: z.string().max(2048),
  widgetId: z.string().uuid().optional(),
});

/**
 * POST /api/spaces/[id]/install/check  { url, widgetId? }
 * Loads a page of the owner's site and says whether it has this space's script and (for a widget that sits in
 * the page) the widget's spot. The page is fetched with the same guard as webhooks (no private or internal
 * addresses, every redirect checked), a few times a minute at most, and only what was found is returned.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("The request body is not valid JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  const limit = await rateLimit(`install_check:${owner.userId}`, { windowMs: 60_000, max: 10 });
  if (!limit.success) {
    return apiError(429, "RATE_LIMITED", "That is a lot of checks. Wait a minute and try again.", {
      headers: { "Retry-After": Math.ceil((limit.reset - Date.now()) / 1000).toString() },
    });
  }

  try {
    const [space] = await db.select({ embedKey: spaces.embedKey }).from(spaces).where(eq(spaces.id, id));
    if (!space) return notFound("Space not found");

    let inline = false;
    if (parsed.data.widgetId) {
      const widget = await getWidget(id, parsed.data.widgetId);
      if (!widget) return notFound("Widget not found");
      inline = layoutInfo(widget.template).placement === "inline";
    }

    const result = await runInstallCheck(parsed.data.url, { embedKey: space.embedKey, widgetId: parsed.data.widgetId, inline });
    return NextResponse.json(result);
  } catch (error) {
    log.error("Install check failed:", error);
    return internalError("The check could not be run");
  }
}
