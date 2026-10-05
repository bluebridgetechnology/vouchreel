import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { aiVideoErrorResponse, requireSpaceOwner } from "@/lib/ai-video/access";
import { getBrandKit, saveBrandKit, suggestedBrandValues, toValues } from "@/lib/brand-kit/service";
import { brandKitSchema } from "@/lib/validations/brand-kit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** The space's brand kit, or the values the widget uses today when none has been saved yet. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: spaceId } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  try {
    const kit = await getBrandKit(spaceId);
    return NextResponse.json({ saved: Boolean(kit), values: kit ? toValues(kit) : await suggestedBrandValues(spaceId) });
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to load brand settings");
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id: spaceId } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  const parsed = brandKitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Validation failed", { details: parsed.error.flatten().fieldErrors });
  }

  try {
    const kit = await saveBrandKit(spaceId, parsed.data);
    return NextResponse.json({ saved: true, values: toValues(kit) });
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to save brand settings");
  }
}
