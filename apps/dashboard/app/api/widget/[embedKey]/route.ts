import { NextResponse } from "next/server";
import { eq, and, asc, desc, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces, testimonials, conversionGoals, reviews, experiments, testimonialTranslations, whiteLabelSettings } from "@/lib/db/schema";
import { DEFAULT_WIDGET_CONFIG, normalizeTheme } from "@/lib/validations/widget-config";
import { badRequest, notFound, internalError } from "@/lib/api/errors";
import { canAccess } from "@/lib/auth/feature-gate";
import { applyBrandKitToTheme, getBrandKit, toValues } from "@/lib/brand-kit/service";
import { getLiveWidgets, listWidgets } from "@/lib/widgets/service";
import { listWidgetVideos } from "@/lib/widget-videos";
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

    // The widgets visitors see, oldest first. A space with none saved yet gets the default widget, as before; a
    // space whose widgets are all switched off gets nothing, and none of its customers' words are sent
    const liveWidgets = await getLiveWidgets(space.id);
    if (liveWidgets.length === 0 && (await listWidgets(space.id)).length > 0) {
      return NextResponse.json(
        { spaceId: space.id, config: null, testimonials: [], reviews: [], conversionGoals: [], activeExperiment: null, whiteLabel: { removeBranding: false, logoUrl: null } },
        { status: 200, headers: { ...corsHeaders, "Cache-Control": "public, max-age=60, s-maxage=60" } }
      );
    }

    // The brand kit, when the owner has saved one, decides colours, radius and typography
    const kit = await getBrandKit(space.id);
    const kitValues = kit ? toValues(kit) : null;
    const configFor = (configRecord: (typeof liveWidgets)[number] | undefined) => {
      const triggerValue =
        configRecord?.triggerValue && typeof configRecord.triggerValue === "object" && Object.keys(configRecord.triggerValue).length > 0
          ? configRecord.triggerValue
          : DEFAULT_WIDGET_CONFIG.triggerValue;
      return {
        template: configRecord?.template || DEFAULT_WIDGET_CONFIG.template,
        position: configRecord?.position || DEFAULT_WIDGET_CONFIG.position,
        theme: applyBrandKitToTheme(normalizeTheme(configRecord?.theme), kitValues),
        trigger: { type: configRecord?.triggerType || DEFAULT_WIDGET_CONFIG.triggerType, value: triggerValue },
        pagesIncluded: configRecord?.pagesIncluded && configRecord.pagesIncluded.length > 0 ? configRecord.pagesIncluded : DEFAULT_WIDGET_CONFIG.pagesIncluded,
        pagesExcluded: configRecord?.pagesExcluded || DEFAULT_WIDGET_CONFIG.pagesExcluded,
        autoplayPreview: configRecord?.autoplayPreview ?? DEFAULT_WIDGET_CONFIG.autoplayPreview,
      };
    };

    // `config` is the first live widget: all an embed script from before there could be several reads. Only
    // when more than one is live is the list added, so the usual response is no bigger than it was
    const config = configFor(liveWidgets[0]);
    const widgets = liveWidgets.length > 1 ? liveWidgets.map((w) => ({ id: w.id, config: configFor(w) })) : undefined;

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

    // Videos the owner chose to show (made from reviews, or AI-narrated). They play like any MP4 testimonial.
    let madeVideos: Awaited<ReturnType<typeof listWidgetVideos>> = [];
    try {
      madeVideos = await listWidgetVideos(space.id);
    } catch (err) {
      log.warn("Could not load generated videos for the widget:", err);
    }

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
        ...(widgets ? { widgets } : {}),
        testimonials: [...testimonialsWithTranslations, ...madeVideos.map((v) => ({ ...v, translations: [] }))],
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
          // A response that carries made videos is cached for less at the CDN: a removed video's file is deleted at once,
          // and this keeps the list that points at it from lingering for minutes
          "Cache-Control": madeVideos.length > 0 ? "public, max-age=60, s-maxage=60" : "public, max-age=60, s-maxage=300",
        },
      }
    );
  } catch (error) {
    log.error("Error fetching widget data:", error);
    return internalError("Internal server error", corsHeaders);
  }
}
