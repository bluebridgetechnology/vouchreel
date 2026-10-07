import { NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { listModerationItems, type ModerationFilter, type ModerationKind } from "@/lib/admin/moderation";

export const dynamic = "force-dynamic";

const KINDS = ["all", "ai", "review"] as const;
const FILTERS: ModerationFilter[] = ["all", "live", "removed", "attention"];

/** GET /api/admin/moderation?kind=all|ai|review&filter=all|live|removed|attention&q=&page= */
export async function GET(request: Request) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") as (typeof KINDS)[number] | null;
  const filter = params.get("filter") as ModerationFilter | null;
  try {
    return NextResponse.json(
      await listModerationItems(
        {
          kind: kind && KINDS.includes(kind) ? (kind as ModerationKind | "all") : "all",
          filter: filter && FILTERS.includes(filter) ? filter : "all",
          q: params.get("q") ?? undefined,
        },
        Number(params.get("page")) || 1
      )
    );
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to load videos");
  }
}
