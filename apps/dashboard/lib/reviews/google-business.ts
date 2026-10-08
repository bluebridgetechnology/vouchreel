import { googleEndpoints } from "./google-oauth";
import type { NormalizedReview } from "./google";

/**
 * Reading an owner's own Business Profile through the access they granted (see google-oauth.ts). Unlike the
 * Places API this returns every review, with the business's own average rating and review count.
 * Endpoint shapes follow Google's Business Profile APIs; nothing here has been run against the real service yet.
 */

type Fetch = typeof fetch;

export interface BusinessLocation {
  /** "accounts/123/locations/456": what we store and what the reviews call needs. */
  id: string;
  title: string;
  address: string | null;
}

export class GoogleApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GoogleApiError";
  }
}

async function getJson<T>(url: string, accessToken: string, fetchImpl: Fetch): Promise<T> {
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    throw new GoogleApiError(body.error?.message || `Google returned ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

/** Every location the owner manages, across the accounts they can see. */
export async function listBusinessLocations(accessToken: string, fetchImpl: Fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<BusinessLocation[]> {
  const endpoints = googleEndpoints(env);
  const accounts = await getJson<{ accounts?: { name: string; accountName?: string }[] }>(endpoints.accounts, accessToken, fetchImpl);
  const out: BusinessLocation[] = [];
  for (const account of accounts.accounts ?? []) {
    let pageToken: string | undefined;
    // A few hundred locations at most is plenty for one owner; the cap keeps a bad response from looping forever
    for (let page = 0; page < 10; page++) {
      const url = new URL(endpoints.locations(account.name));
      url.searchParams.set("readMask", "name,title,storefrontAddress");
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const data = await getJson<{
        locations?: { name: string; title?: string; storefrontAddress?: { locality?: string; addressLines?: string[]; regionCode?: string } }[];
        nextPageToken?: string;
      }>(url.toString(), accessToken, fetchImpl);
      for (const loc of data.locations ?? []) {
        // The business information API names a location "locations/456"; the reviews API wants "accounts/123/locations/456"
        const id = loc.name.startsWith("accounts/") ? loc.name : `${account.name}/${loc.name}`;
        const addr = loc.storefrontAddress;
        const address = addr ? [addr.addressLines?.[0], addr.locality, addr.regionCode].filter(Boolean).join(", ") : "";
        out.push({ id, title: loc.title || account.accountName || id, address: address || null });
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  }
  return out;
}

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/**
 * Google shows a translated review with both versions in the comment: "(Translated by Google) ... (Original) ...".
 * The reviewer's own words are the original, so that is what we keep.
 */
export function reviewerOwnWords(comment: string | undefined): string {
  const text = (comment ?? "").trim();
  const original = /\(Original\)\s*([\s\S]*)$/.exec(text);
  if (/^\(Translated by Google\)/.test(text) && original) return original[1].trim();
  return text;
}

interface RawReview {
  reviewId?: string;
  name?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
}

export async function fetchBusinessReviews(
  locationId: string,
  accessToken: string,
  fetchImpl: Fetch = fetch,
  env: Record<string, string | undefined> = process.env
): Promise<{ rating?: number; totalReviews?: number; reviews: NormalizedReview[] }> {
  const endpoints = googleEndpoints(env);
  const reviews: NormalizedReview[] = [];
  let rating: number | undefined;
  let totalReviews: number | undefined;
  let pageToken: string | undefined;
  // 20 pages of 50 is 1,000 reviews: more than a video tool needs, and a stop for a response that never ends
  for (let page = 0; page < 20; page++) {
    const url = new URL(endpoints.reviews(locationId));
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await getJson<{ reviews?: RawReview[]; averageRating?: number; totalReviewCount?: number; nextPageToken?: string }>(
      url.toString(),
      accessToken,
      fetchImpl
    );
    if (typeof data.averageRating === "number") rating = data.averageRating;
    if (typeof data.totalReviewCount === "number") totalReviews = data.totalReviewCount;
    for (const r of data.reviews ?? []) {
      const stars = STARS[r.starRating ?? ""];
      const id = r.reviewId || r.name?.split("/").pop();
      if (!stars || !id) continue; // an unrated or unidentifiable entry cannot be shown or de-duplicated
      reviews.push({
        providerReviewId: `google_bp_${id}`,
        authorName: r.reviewer?.isAnonymous ? "A Google user" : r.reviewer?.displayName || "A Google user",
        authorPhotoUrl: r.reviewer?.isAnonymous ? null : r.reviewer?.profilePhotoUrl || null,
        rating: stars,
        text: reviewerOwnWords(r.comment),
        reviewDate: r.createTime ? new Date(r.createTime) : new Date(),
      });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return {
    ...(rating !== undefined ? { rating } : {}),
    ...(totalReviews !== undefined ? { totalReviews } : {}),
    reviews,
  };
}
