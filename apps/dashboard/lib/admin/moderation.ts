import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { generatedVideos, reviewVideos, spaces, testimonialConsents, testimonials, user } from "@/lib/db/schema";
import { AI_VIDEO_CONSENT_VERSION } from "@/lib/ai-video/consent";
import { REVIEW_RIGHTS_VERSION } from "@/lib/review-video/rights";
import { notifySpaceOwner } from "@/lib/notifications/service";
import { getStorage } from "@/lib/storage";
import { storageKeyFromUrl } from "@/lib/storage/video-files";
import { clampedPage } from "@/lib/admin/paging";
import { likeLiteral } from "@/lib/admin/queries";

/**
 * Platform-admin moderation of finished videos (AI videos and review videos). A takedown is
 * irreversible: the stored file is deleted (their public URLs stop working), the URL is cleared,
 * and who removed it and why is recorded and shown to the owner. The credit stays spent.
 * It only completes when the file really is gone, so a failed delete can simply be retried.
 */

export type ModerationKind = "ai" | "review";
export type ModerationFilter = "all" | "live" | "removed" | "attention";

export const MODERATION_PAGE_SIZE = 25;
export const REASON_MIN = 5;
export const REASON_MAX = 500;

export interface ModerationItem {
  kind: ModerationKind;
  id: string;
  status: string;
  template: string;
  createdAt: Date;
  spaceId: string;
  spaceName: string;
  ownerEmail: string | null;
  outputUrl: string | null;
  /** What the video says: the narrated script (AI) or the reviews shown (review video), shortened. */
  content: string;
  /** Who it quotes. */
  attribution: string | null;
  /** AI videos only: the consent the customer gave. */
  consent: { source: string; textVersion: string; grantedAt: Date; revokedAt: Date | null; currentWording: boolean } | null;
  /** Review videos only: when the owner confirmed they may use the reviews, and which wording they saw (null on videos made before it was recorded). */
  rightsConfirmedAt: Date | null;
  rightsWording: { version: string | null; current: boolean } | null;
  /** The consent was withdrawn but the video is still up. */
  needsAttention: boolean;
  removed: { at: Date; reason: string | null; byEmail: string | null } | null;
}

export interface ModerationPage {
  items: ModerationItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ModerationQuery {
  kind?: ModerationKind | "all";
  filter?: ModerationFilter;
  q?: string;
}

const shorten = (text: string, max = 280) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

/** Text of the reviews a review video shows, from the exact props that were rendered. */
function reviewContent(props: Record<string, unknown>): { content: string; attribution: string | null } {
  const list = Array.isArray(props.reviews) ? (props.reviews as { text?: unknown; author?: unknown }[]) : [];
  const texts = list.map((r) => (typeof r.text === "string" ? r.text : "")).filter(Boolean);
  const authors = list.map((r) => (typeof r.author === "string" ? r.author : "")).filter(Boolean);
  return { content: shorten(texts.join("  |  ")), attribution: authors.length ? authors.join(", ") : null };
}

function whereFor(kind: ModerationKind, query: ModerationQuery): SQL | undefined {
  const t = kind === "ai" ? generatedVideos : reviewVideos;
  const term = query.q?.trim();
  const filter = query.filter ?? "all";
  return and(
    // Only videos that have a file, or had one taken down
    or(isNotNull(t.outputUrl), isNotNull(t.moderatedAt)),
    filter === "live" ? and(isNotNull(t.outputUrl), isNull(t.moderatedAt)) : undefined,
    filter === "removed" ? isNotNull(t.moderatedAt) : undefined,
    // "attention" is about consent, which review videos do not have, so they never match it
    filter === "attention" ? (kind === "ai" ? and(isNotNull(t.outputUrl), isNull(t.moderatedAt), isNotNull(testimonialConsents.revokedAt)) : sql`false`) : undefined,
    term ? or(ilike(user.email, `%${likeLiteral(term)}%`), ilike(spaces.name, `%${likeLiteral(term)}%`)) : undefined
  );
}

export function listModerationItems(query: ModerationQuery = {}, page = 1, pageSize = MODERATION_PAGE_SIZE): Promise<ModerationPage> {
  return clampedPage((p) => listModerationItemsAt(query, p, pageSize), page, pageSize);
}

async function listModerationItemsAt(query: ModerationQuery, page: number, pageSize: number): Promise<ModerationPage> {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const kinds: ModerationKind[] = query.kind === "ai" ? ["ai"] : query.kind === "review" ? ["review"] : ["ai", "review"];
  const take = safePage * pageSize; // enough rows from each table to fill this page after merging
  let total = 0;
  const rows: ModerationItem[] = [];

  if (kinds.includes("ai")) {
    const w = whereFor("ai", query);
    const [{ value }] = await db
      .select({ value: count() })
      .from(generatedVideos)
      .innerJoin(spaces, eq(generatedVideos.spaceId, spaces.id))
      .leftJoin(user, eq(spaces.ownerId, user.id))
      .innerJoin(testimonialConsents, eq(generatedVideos.consentId, testimonialConsents.id))
      .where(w);
    total += value;
    const found = await db
      .select({
        v: generatedVideos,
        spaceName: spaces.name,
        ownerEmail: user.email,
        consent: testimonialConsents,
        customerName: testimonials.customerName,
        customerCompany: testimonials.customerCompany,
      })
      .from(generatedVideos)
      .innerJoin(spaces, eq(generatedVideos.spaceId, spaces.id))
      .leftJoin(user, eq(spaces.ownerId, user.id))
      .innerJoin(testimonialConsents, eq(generatedVideos.consentId, testimonialConsents.id))
      .innerJoin(testimonials, eq(generatedVideos.testimonialId, testimonials.id))
      .where(w)
      .orderBy(desc(generatedVideos.createdAt), desc(generatedVideos.id))
      .limit(take);
    const byIds = await moderatorEmails(found.map((f) => f.v.moderatedBy));
    for (const f of found) {
      rows.push({
        kind: "ai",
        id: f.v.id,
        status: f.v.status,
        template: f.v.template,
        createdAt: f.v.createdAt,
        spaceId: f.v.spaceId,
        spaceName: f.spaceName,
        ownerEmail: f.ownerEmail,
        outputUrl: f.v.outputUrl,
        content: shorten(f.v.scriptTrimmed ?? f.v.scriptOriginal),
        attribution: [f.customerName, f.customerCompany].filter(Boolean).join(", ") || null,
        consent: {
          source: f.consent.source,
          textVersion: f.consent.textVersion,
          grantedAt: f.consent.grantedAt,
          revokedAt: f.consent.revokedAt,
          currentWording: f.consent.textVersion === AI_VIDEO_CONSENT_VERSION,
        },
        rightsConfirmedAt: null,
        rightsWording: null,
        needsAttention: !!f.v.outputUrl && !f.v.moderatedAt && !!f.consent.revokedAt,
        removed: f.v.moderatedAt ? { at: f.v.moderatedAt, reason: f.v.moderationReason, byEmail: f.v.moderatedBy ? (byIds.get(f.v.moderatedBy) ?? null) : null } : null,
      });
    }
  }

  if (kinds.includes("review")) {
    const w = whereFor("review", query);
    const [{ value }] = await db
      .select({ value: count() })
      .from(reviewVideos)
      .innerJoin(spaces, eq(reviewVideos.spaceId, spaces.id))
      .leftJoin(user, eq(spaces.ownerId, user.id))
      .where(w);
    total += value;
    const found = await db
      .select({ v: reviewVideos, spaceName: spaces.name, ownerEmail: user.email })
      .from(reviewVideos)
      .innerJoin(spaces, eq(reviewVideos.spaceId, spaces.id))
      .leftJoin(user, eq(spaces.ownerId, user.id))
      .where(w)
      .orderBy(desc(reviewVideos.createdAt), desc(reviewVideos.id))
      .limit(take);
    const byIds = await moderatorEmails(found.map((f) => f.v.moderatedBy));
    for (const f of found) {
      const { content, attribution } = reviewContent(f.v.props);
      rows.push({
        kind: "review",
        id: f.v.id,
        status: f.v.status,
        template: f.v.template,
        createdAt: f.v.createdAt,
        spaceId: f.v.spaceId,
        spaceName: f.spaceName,
        ownerEmail: f.ownerEmail,
        outputUrl: f.v.outputUrl,
        content,
        attribution,
        consent: null,
        rightsConfirmedAt: f.v.rightsConfirmedAt,
        rightsWording: { version: f.v.rightsWordingVersion, current: f.v.rightsWordingVersion === REVIEW_RIGHTS_VERSION },
        needsAttention: false,
        removed: f.v.moderatedAt ? { at: f.v.moderatedAt, reason: f.v.moderationReason, byEmail: f.v.moderatedBy ? (byIds.get(f.v.moderatedBy) ?? null) : null } : null,
      });
    }
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
  return { items: rows.slice((safePage - 1) * pageSize, safePage * pageSize), total, page: safePage, pageSize };
}

async function moderatorEmails(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((i): i is string => !!i))];
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, unique));
  return new Map(rows.map((r) => [r.id, r.email]));
}

export type TakeDownResult =
  | { ok: true; kind: ModerationKind; id: string; spaceId: string; ownerEmail: string | null; template: string }
  | { ok: false; reason: "not_found" | "already_removed" | "no_file" | "cannot_locate_file" | "storage_failed"; message: string };

export async function takeDownVideo(kind: ModerationKind, id: string, actorId: string, reason: string): Promise<TakeDownResult> {
  const t = kind === "ai" ? generatedVideos : reviewVideos;
  const [video] = await db
    .select({ id: t.id, spaceId: t.spaceId, template: t.template, outputUrl: t.outputUrl, moderatedAt: t.moderatedAt })
    .from(t)
    .where(eq(t.id, id));
  if (!video) return { ok: false, reason: "not_found", message: "Video not found." };
  if (video.moderatedAt) return { ok: false, reason: "already_removed", message: "This video was already taken down." };
  if (!video.outputUrl) return { ok: false, reason: "no_file", message: "This video has no file to remove (it failed, was never finished, or its owner deleted it)." };

  const key = storageKeyFromUrl(video.outputUrl, kind);
  if (!key) return { ok: false, reason: "cannot_locate_file", message: "Could not work out where this file is stored from its URL, so nothing was changed." };

  try {
    await getStorage().delete(key);
  } catch (error) {
    return {
      ok: false,
      reason: "storage_failed",
      message: `The file could not be deleted (${error instanceof Error ? error.message : "storage error"}). Nothing was changed; try again.`,
    };
  }

  await db.update(t).set({ outputUrl: null, moderatedAt: new Date(), moderatedBy: actorId, moderationReason: reason }).where(eq(t.id, id));

  const [owner] = await db
    .select({ email: user.email })
    .from(spaces)
    .leftJoin(user, eq(spaces.ownerId, user.id))
    .where(eq(spaces.id, video.spaceId));
  void notifySpaceOwner(video.spaceId, {
    type: "video.removed",
    title: "A video was removed by our team",
    body: reason,
    href: `/spaces/${video.spaceId}`,
    metadata: { videoId: id, kind },
  });
  return { ok: true, kind, id, spaceId: video.spaceId, ownerEmail: owner?.email ?? null, template: video.template };
}
