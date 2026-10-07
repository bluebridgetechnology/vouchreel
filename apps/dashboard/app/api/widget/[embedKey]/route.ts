import { NextResponse } from "next/server";
import { eq, and, asc, desc, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces, testimonials, widgetConfigs, conversionGoals, reviews, experiments, testimonialTranslations, whiteLabelSettings } from "@/lib/db/schema";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/validations/widget-config";
import { badRequest, notFound, internalError } from "@/lib/api/errors";
import { canAccess } from "@/lib/auth/feature-gate";
import { applyBrandKitToTheme, getBrandKit, toValues } from "@/lib/brand-kit/service";
import { log } from "@/lib/log";

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
    return badRequest("Invalid embed key", corsHeaders);
  }

  try {
    const [space] = await db
      .select({
        id: spaces.id,
        name: spaces.name,
        ownerId: spaces.ownerId,
        embedKey: spaces.embedKey,
      })
      .from(spaces)
      .where(eq(spaces.embedKey, embedKey));

    if (!space) {
      return notFound("Widget not found", corsHeaders);
    }

    // Fetch widget configuration
    const [configRecord] = await db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.spaceId, space.id));

    const baseTheme =
      configRecord?.theme &&
      typeof configRecord.theme === "object" &&
      Object.keys(configRecord.theme).length > 0
        ? { ...DEFAULT_WIDGET_CONFIG.theme, ...configRecord.theme }
        : DEFAULT_WIDGET_CONFIG.theme;

    // The brand kit, when the owner has saved one, decides colours, radius and typography
    const kit = await getBrandKit(space.id);
    const theme = applyBrandKitToTheme(baseTheme, kit ? toValues(kit) : null);

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
      template: configRecord?.template || DEFAULT_WIDGET_CONFIG.template,
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

    // Optional visitor language query param filter
    const url = new URL(request.url);
    const requestedLang = url.searchParams.get("lang")?.toLowerCase()?.trim();

    // Fetch translations for active testimonials
    const testimonialIds = activeTestimonials.map((t) => t.id);
    let translationsList: Array<{
      testimonialId: string;
      language: string;
      quote: string | null;
      transcript: unknown;
    }> = [];

    if (testimonialIds.length > 0) {
      try {
        const query = db
          .select({
            testimonialId: testimonialTranslations.testimonialId,
            language: testimonialTranslations.language,
            quote: testimonialTranslations.quote,
            transcript: testimonialTranslations.transcript,
          })
          .from(testimonialTranslations)
          .where(
            requestedLang
              ? and(
                  inArray(testimonialTranslations.testimonialId, testimonialIds),
                  eq(testimonialTranslations.language, requestedLang)
                )
              : inArray(testimonialTranslations.testimonialId, testimonialIds)
          );

        const res = await query;
        if (Array.isArray(res)) {
          translationsList = res;
        }
      } catch (err) {
        log.warn("Could not load translations for widget testimonials:", err);
      }
    }

    const translationsMap = new Map<
      string,
      Array<{ language: string; quote: string | null; transcript: unknown }>
    >();
    for (const tr of translationsList) {
      const current = translationsMap.get(tr.testimonialId) || [];
      current.push({
        language: tr.language,
        quote: tr.quote,
        transcript: tr.transcript,
      });
      translationsMap.set(tr.testimonialId, current);
    }

    const testimonialsWithTranslations = activeTestimonials.map((t) => ({
      ...t,
      translations: translationsMap.get(t.id) || [],
    }));

    // Fetch approved text reviews for this space
    const approvedReviews = await db
      .select({
        id: reviews.id,
        provider: reviews.provider,
        authorName: reviews.authorName,
        authorPhotoUrl: reviews.authorPhotoUrl,
        rating: reviews.rating,
        text: reviews.text,
        reviewDate: reviews.reviewDate,
      })
      .from(reviews)
      .where(
        // Reviews the owner typed in are for videos only: the widget's badges name a provider
        and(eq(reviews.spaceId, space.id), eq(reviews.isApproved, true), ne(reviews.provider, "own"))
      )
      .orderBy(desc(reviews.reviewDate), desc(reviews.createdAt));

    // Fetch conversion goals for this space
    const goals = await db
      .select({
        id: conversionGoals.id,
        goalType: conversionGoals.goalType,
        goalValue: conversionGoals.goalValue,
      })
      .from(conversionGoals)
      .where(eq(conversionGoals.spaceId, space.id));

    // Fetch active running experiment for this space if one exists
    const [activeExp] = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        type: experiments.type,
        variants: experiments.variants,
        trafficSplit: experiments.trafficSplit,
      })
      .from(experiments)
      .where(
        and(
          eq(experiments.spaceId, space.id),
          eq(experiments.status, "running")
        )
      )
      .orderBy(desc(experiments.startedAt), desc(experiments.createdAt))
      .limit(1);

    // Fetch white-label settings & entitlement
    let whiteLabel = { removeBranding: false, logoUrl: null as string | null };
    try {
      const isWhiteLabelEntitled = space.ownerId
        ? await canAccess(space.ownerId, "white-label")
        : false;

      if (isWhiteLabelEntitled) {
        const [wlRecord] = await db
          .select()
          .from(whiteLabelSettings)
          .where(eq(whiteLabelSettings.spaceId, space.id));

        if (wlRecord) {
          whiteLabel = {
            removeBranding: wlRecord.removeBranding,
            logoUrl: wlRecord.logoUrl,
          };
        }
      }
    } catch {
      // Ignore if unconfigured or mocked
    }

    return NextResponse.json(
      {
        spaceId: space.id,
        config,
        testimonials: testimonialsWithTranslations,
        reviews: approvedReviews,
        conversionGoals: goals,
        activeExperiment: activeExp
          ? {
              id: activeExp.id,
              name: activeExp.name,
              type: activeExp.type,
              variants: activeExp.variants,
              trafficSplit: activeExp.trafficSplit,
            }
          : null,
        whiteLabel,
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
    log.error("Error fetching widget data:", error);
    return internalError("Internal server error", corsHeaders);
  }
}
