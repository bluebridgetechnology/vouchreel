import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces, testimonials, widgetConfigs, conversionGoals } from "@/lib/db/schema";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/validations/widget-config";

interface RouteParams {
  params: Promise<{ embedKey: string }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * OPTIONS /api/widget/[embedKey]
 * Handles CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * GET /api/widget/[embedKey]
 * Public endpoint consumed by the embed widget script.
 * Returns widget configuration, active testimonials, and conversion goals.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { embedKey } = await params;

  if (!embedKey || typeof embedKey !== "string") {
    return NextResponse.json(
      { error: "Invalid embed key" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const [space] = await db
      .select({
        id: spaces.id,
        name: spaces.name,
        embedKey: spaces.embedKey,
      })
      .from(spaces)
      .where(eq(spaces.embedKey, embedKey));

    if (!space) {
      return NextResponse.json(
        { error: "Widget not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch widget configuration
    const [configRecord] = await db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.spaceId, space.id));

    const theme =
      configRecord?.theme &&
      typeof configRecord.theme === "object" &&
      Object.keys(configRecord.theme).length > 0
        ? { ...DEFAULT_WIDGET_CONFIG.theme, ...configRecord.theme }
        : DEFAULT_WIDGET_CONFIG.theme;

    const triggerValue =
      configRecord?.triggerValue &&
      typeof configRecord.triggerValue === "object" &&
      Object.keys(configRecord.triggerValue).length > 0
        ? configRecord.triggerValue
        : DEFAULT_WIDGET_CONFIG.triggerValue;

    const pagesIncluded =
      configRecord?.pagesIncluded && configRecord.pagesIncluded.length > 0
        ? configRecord.pagesIncluded
        : DEFAULT_WIDGET_CONFIG.pagesIncluded;

    const pagesExcluded = configRecord?.pagesExcluded || DEFAULT_WIDGET_CONFIG.pagesExcluded;

    const config = {
      position: configRecord?.position || DEFAULT_WIDGET_CONFIG.position,
      theme,
      trigger: {
        type: configRecord?.triggerType || DEFAULT_WIDGET_CONFIG.triggerType,
        value: triggerValue,
      },
      pagesIncluded,
      pagesExcluded,
      autoplayPreview:
        configRecord?.autoplayPreview ?? DEFAULT_WIDGET_CONFIG.autoplayPreview,
    };

    // Fetch active testimonials only, ordered by sortOrder then createdAt
    const activeTestimonials = await db
      .select({
        id: testimonials.id,
        videoUrl: testimonials.videoUrl,
        platform: testimonials.platform,
        thumbnailUrl: testimonials.thumbnailUrl,
        title: testimonials.title,
        quote: testimonials.quote,
        customerName: testimonials.customerName,
        customerCompany: testimonials.customerCompany,
        durationSeconds: testimonials.durationSeconds,
        matchRules: testimonials.matchRules,
      })
      .from(testimonials)
      .where(
        and(eq(testimonials.spaceId, space.id), eq(testimonials.isActive, true))
      )
      .orderBy(asc(testimonials.sortOrder), asc(testimonials.createdAt));

    // Fetch conversion goals for this space
    const goals = await db
      .select({
        id: conversionGoals.id,
        goalType: conversionGoals.goalType,
        goalValue: conversionGoals.goalValue,
      })
      .from(conversionGoals)
      .where(eq(conversionGoals.spaceId, space.id));

    return NextResponse.json(
      {
        spaceId: space.id,
        config,
        testimonials: activeTestimonials,
        conversionGoals: goals,
      },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Cache-Control": "public, max-age=60, s-maxage=300",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching widget data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
