import { and, count, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionForms, events, reviewSources, spaces, submissions, testimonials, widgetConfigs } from "@/lib/db/schema";
import { getSubscriptionLimits } from "@/lib/payments/subscription";
import { fillDays } from "./format";

/**
 * Everything the home page shows, for the spaces a user owns (the same spaces /spaces lists).
 * A handful of grouped queries, each over the owner's spaces at once, never one query per space.
 */

export type HomeRange = 7 | 30;

export interface PulseMetric {
  current: number;
  previous: number;
  series: number[];
}

export interface HomeData {
  range: HomeRange;
  spaces: { id: string; name: string; testimonialCount: number; plays: number; series: number[] }[];
  pulse: { impressions: PulseMetric; plays: PulseMetric; conversions: PulseMetric };
  spotlight: {
    testimonial: {
      id: string;
      spaceId: string;
      spaceName: string;
      customerName: string | null;
      customerCompany: string | null;
      quote: string | null;
      thumbnailUrl: string | null;
      videoUrl: string | null;
      platform: string;
    };
    plays: number;
    /** Sessions that played this video and converted afterwards, in the same period. */
    convertingViewers: number;
  } | null;
  checklist: { key: string; label: string; done: boolean; href: string }[];
  needs: {
    pending: { spaceId: string; spaceName: string; count: number }[];
    pendingThumbnails: string[];
    failedUploads: number;
    reviewSourceErrors: { spaceId: string; spaceName: string; name: string }[];
    limits: { label: string; used: number; max: number; href: string }[];
  };
  faces: { id: string; spaceId: string; customerName: string | null; thumbnailUrl: string | null }[];
}

const DAY = 86_400_000;

/** Midnight UTC `days - 1` days ago: the first of `days` whole daily buckets ending today. */
export function rangeStart(days: number, now = new Date()): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - (days - 1) * DAY);
}

/** Share of a limit at which the home page starts mentioning it. */
const LIMIT_WARN_AT = 0.8;

export async function getHomeData(userId: string, range: HomeRange, now = new Date()): Promise<HomeData | null> {
  const owned = await db
    .select({ id: spaces.id, name: spaces.name })
    .from(spaces)
    .where(eq(spaces.ownerId, userId))
    .orderBy(desc(spaces.createdAt));
  if (owned.length === 0) return null;

  const ids = owned.map((s) => s.id);
  const nameOf = new Map(owned.map((s) => [s.id, s.name]));
  const start = rangeStart(range, now);
  const previousStart = new Date(start.getTime() - range * DAY);
  const day = sql<string>`date_trunc('day', ${events.timestamp} at time zone 'UTC')::date::text`;

  const [daily, perSpace, testimonialCounts, top, pending, pendingThumbs, failed, sourceErrors, setup, limits, faces] = await Promise.all([
    // Pulse: counts per day and type over this period and the one before
    db
      .select({ day, type: events.eventType, value: count() })
      .from(events)
      .where(and(inArray(events.spaceId, ids), gte(events.timestamp, previousStart), inArray(events.eventType, ["impression", "play", "convert"])))
      .groupBy(day, events.eventType),

    // Plays per space per day, for each space card's sparkline
    db
      .select({ spaceId: events.spaceId, day, value: count() })
      .from(events)
      .where(and(inArray(events.spaceId, ids), gte(events.timestamp, start), eq(events.eventType, "play")))
      .groupBy(events.spaceId, day),

    db
      .select({ spaceId: testimonials.spaceId, value: count() })
      .from(testimonials)
      .where(inArray(testimonials.spaceId, ids))
      .groupBy(testimonials.spaceId),

    // Spotlight: the most played video of the last 7 days, with how many of its viewers converted later
    db
      .select({
        testimonialId: events.testimonialId,
        plays: count(),
        convertingViewers: sql<number>`(
          select count(distinct c.session_id)::int from ${events} c
          where c.space_id = ${events.spaceId} and c.event_type = 'convert' and c.timestamp >= ${rangeStart(7, now)}
            and c.session_id in (
              select p.session_id from ${events} p
              where p.testimonial_id = ${events.testimonialId} and p.event_type = 'play' and p.timestamp >= ${rangeStart(7, now)}
                and p.timestamp <= c.timestamp
            )
        )`,
      })
      .from(events)
      .innerJoin(testimonials, eq(testimonials.id, events.testimonialId))
      .where(
        and(
          inArray(events.spaceId, ids),
          eq(events.eventType, "play"),
          gte(events.timestamp, rangeStart(7, now)),
          eq(testimonials.isActive, true),
          ne(testimonials.platform, "text")
        )
      )
      .groupBy(events.testimonialId, events.spaceId)
      .orderBy(desc(count()))
      .limit(1),

    db
      .select({ spaceId: collectionForms.spaceId, value: count() })
      .from(submissions)
      .innerJoin(collectionForms, eq(collectionForms.id, submissions.formId))
      .where(and(inArray(collectionForms.spaceId, ids), eq(submissions.status, "pending")))
      .groupBy(collectionForms.spaceId),

    db
      .select({ thumbnailUrl: submissions.thumbnailUrl })
      .from(submissions)
      .innerJoin(collectionForms, eq(collectionForms.id, submissions.formId))
      .where(and(inArray(collectionForms.spaceId, ids), eq(submissions.status, "pending"), isNotNull(submissions.thumbnailUrl)))
      .orderBy(desc(submissions.createdAt))
      .limit(4),

    db
      .select({ value: count() })
      .from(submissions)
      .innerJoin(collectionForms, eq(collectionForms.id, submissions.formId))
      .where(and(inArray(collectionForms.spaceId, ids), eq(submissions.status, "pending"), eq(submissions.processingStatus, "failed"))),

    db
      .select({ spaceId: reviewSources.spaceId, name: reviewSources.displayName, provider: reviewSources.provider })
      .from(reviewSources)
      .where(and(inArray(reviewSources.spaceId, ids), isNotNull(reviewSources.lastError))),

    // Setup checklist: one cheap existence check per step
    Promise.all([
      db.select({ id: testimonials.id }).from(testimonials).where(inArray(testimonials.spaceId, ids)).limit(1),
      db.select({ id: widgetConfigs.id }).from(widgetConfigs).where(inArray(widgetConfigs.spaceId, ids)).limit(1),
      db.select({ id: events.id }).from(events).where(and(inArray(events.spaceId, ids), eq(events.eventType, "impression"))).limit(1),
      db.select({ id: collectionForms.id }).from(collectionForms).where(inArray(collectionForms.spaceId, ids)).limit(1),
    ]),

    getSubscriptionLimits(userId),

    db
      .select({ id: testimonials.id, spaceId: testimonials.spaceId, customerName: testimonials.customerName, thumbnailUrl: testimonials.thumbnailUrl })
      .from(testimonials)
      .where(and(inArray(testimonials.spaceId, ids), eq(testimonials.isActive, true), ne(testimonials.platform, "text")))
      .orderBy(desc(testimonials.createdAt))
      .limit(12),
  ]);

  // Pulse
  const series = (type: string, from: Date) =>
    fillDays(
      daily.filter((r) => r.type === type).map((r) => ({ day: r.day, value: r.value })),
      from,
      range
    );
  const metric = (type: string): PulseMetric => {
    const current = series(type, start);
    const previous = series(type, previousStart);
    return { current: sum(current), previous: sum(previous), series: current };
  };

  // Spotlight
  let spotlight: HomeData["spotlight"] = null;
  if (top[0]?.testimonialId) {
    const [t] = await db.select().from(testimonials).where(eq(testimonials.id, top[0].testimonialId));
    if (t) {
      spotlight = {
        testimonial: {
          id: t.id,
          spaceId: t.spaceId,
          spaceName: nameOf.get(t.spaceId) ?? "",
          customerName: t.customerName,
          customerCompany: t.customerCompany,
          quote: t.quote,
          thumbnailUrl: t.thumbnailUrl,
          videoUrl: t.videoUrl,
          platform: t.platform,
        },
        plays: top[0].plays,
        convertingViewers: Number(top[0].convertingViewers) || 0,
      };
    }
  }

  // Spaces
  const countOf = new Map(testimonialCounts.map((r) => [r.spaceId, r.value]));
  const spaceCards = owned.map((s) => {
    const values = fillDays(
      perSpace.filter((r) => r.spaceId === s.id).map((r) => ({ day: r.day, value: r.value })),
      start,
      range
    );
    return { id: s.id, name: s.name, testimonialCount: countOf.get(s.id) ?? 0, plays: sum(values), series: values };
  });

  // Checklist (links go to the newest space)
  const first = owned[0].id;
  const [hasTestimonial, hasWidget, hasImpression, hasForm] = setup.map((rows) => rows.length > 0);
  const checklist = [
    { key: "space", label: "Create a space", done: true, href: "/spaces/new" },
    { key: "testimonial", label: "Add your first testimonial", done: hasTestimonial, href: `/spaces/${first}/testimonials` },
    { key: "widget", label: "Style your widget", done: hasWidget, href: `/spaces/${first}/widget` },
    { key: "install", label: "Put the widget on your site", done: hasImpression, href: `/spaces/${first}/widget` },
    { key: "collect", label: "Ask customers for a video", done: hasForm, href: `/spaces/${first}/collect` },
  ];

  // Limits close to full
  const limitRows: HomeData["needs"]["limits"] = [];
  if (Number.isFinite(limits.maxSpaces) && owned.length >= limits.maxSpaces * LIMIT_WARN_AT) {
    limitRows.push({ label: "Spaces", used: owned.length, max: limits.maxSpaces, href: "/settings/billing" });
  }
  if (Number.isFinite(limits.maxTestimonialsPerSpace)) {
    for (const s of spaceCards) {
      if (s.testimonialCount >= limits.maxTestimonialsPerSpace * LIMIT_WARN_AT) {
        limitRows.push({ label: `Testimonials in ${s.name}`, used: s.testimonialCount, max: limits.maxTestimonialsPerSpace, href: "/settings/billing" });
      }
    }
  }

  return {
    range,
    spaces: spaceCards,
    pulse: { impressions: metric("impression"), plays: metric("play"), conversions: metric("convert") },
    spotlight,
    checklist,
    needs: {
      pending: pending.map((r) => ({ spaceId: r.spaceId, spaceName: nameOf.get(r.spaceId) ?? "", count: r.value })).filter((r) => r.count > 0),
      pendingThumbnails: pendingThumbs.map((r) => r.thumbnailUrl).filter((u): u is string => Boolean(u)),
      failedUploads: failed[0]?.value ?? 0,
      reviewSourceErrors: sourceErrors.map((r) => ({ spaceId: r.spaceId, spaceName: nameOf.get(r.spaceId) ?? "", name: r.name || (r.provider === "google" ? "Google" : "Trustpilot") })),
      limits: limitRows,
    },
    faces,
  };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
