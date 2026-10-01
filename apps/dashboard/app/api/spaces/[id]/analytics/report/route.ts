import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collectionForms, socialExportSettings, spaces } from "@/lib/db/schema";
import {
  getConversionFunnel,
  getOverviewStats,
  getPerTestimonialStats,
} from "@/lib/analytics/queries";
import {
  generateExecutiveHtml,
  generateExecutivePdf,
  ReportBranding,
} from "@/lib/analytics/pdf-report";
import {
  analyticsReportQuerySchema,
  resolveDateRange,
} from "@/lib/validations/analytics";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/[id]/analytics/report
 * Query params: format (pdf|html), startDate, endDate (YYYY-MM-DD),
 * and optional branding overrides (brandName, logoUrl, brandColor).
 *
 * Generates an executive PDF or printable HTML summary report with agency white-labeling.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = analyticsReportQuerySchema.safeParse({
    format: url.searchParams.get("format") ?? undefined,
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    brandName: url.searchParams.get("brandName") ?? undefined,
    logoUrl: url.searchParams.get("logoUrl") ?? undefined,
    brandColor: url.searchParams.get("brandColor") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Validation failed", {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, id));

    if (!space) {
      return apiError(404, "NOT_FOUND", "Space not found");
    }

    if (space.ownerId !== session.user.id) {
      return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");
    }

    // 1. Resolve Agency White-Labeling Branding
    const [socialSettings] = await db
      .select()
      .from(socialExportSettings)
      .where(eq(socialExportSettings.spaceId, space.id));

    const forms = await db
      .select()
      .from(collectionForms)
      .where(eq(collectionForms.spaceId, space.id));

    const formBranding = forms.find((f) => f.branding?.logoUrl || f.branding?.accentColor)?.branding;

    const brandName =
      parsed.data.brandName ||
      undefined;

    const logoUrl =
      parsed.data.logoUrl ||
      socialSettings?.logoUrl ||
      formBranding?.logoUrl ||
      undefined;

    const brandColor =
      parsed.data.brandColor ||
      socialSettings?.brandColor ||
      formBranding?.accentColor ||
      DEFAULT_BRAND_HEX;

    const isWhiteLabeled = Boolean(
      parsed.data.brandName ||
      socialSettings?.logoUrl ||
      formBranding?.logoUrl ||
      formBranding?.accentColor
    );

    const branding: ReportBranding = {
      isWhiteLabeled,
      brandName: brandName || (isWhiteLabeled ? space.name : undefined),
      brandColor,
      logoUrl,
    };

    // 2. Fetch Report Metrics
    const dateRange = resolveDateRange(parsed.data);
    const [stats, funnel, testimonials] = await Promise.all([
      getOverviewStats(space.id, dateRange),
      getConversionFunnel(space.id, dateRange),
      getPerTestimonialStats(space.id, dateRange),
    ]);

    const reportData = {
      spaceName: space.name,
      spaceId: space.id,
      dateRange,
      generatedAt: new Date(),
      branding,
      stats,
      funnel,
      testimonials,
    };

    const safeBaseName = (branding.isWhiteLabeled && branding.brandName
      ? branding.brandName
      : "vouchreel-report"
    )
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-");

    if (parsed.data.format === "html") {
      const htmlContent = generateExecutiveHtml(reportData);
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // Default: PDF format
    const pdfBytes = await generateExecutivePdf(reportData);
    const filename = `${safeBaseName}-${space.id.slice(0, 8)}.pdf`;

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate analytics report:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to generate analytics report");
  }
}
