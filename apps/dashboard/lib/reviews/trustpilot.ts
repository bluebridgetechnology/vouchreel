import { NormalizedReview } from "./google";

export interface TrustpilotConsumer {
  id?: string;
  displayName: string;
  displayLocation?: string;
  numberOfReviews?: number;
  profileImageUrl?: string;
}

export interface TrustpilotReviewItem {
  id: string;
  stars: number;
  title?: string;
  text?: string;
  language?: string;
  createdAt: string;
  consumer: TrustpilotConsumer;
}

export interface TrustpilotReviewsResponse {
  reviews: TrustpilotReviewItem[];
  links?: Array<{ rel: string; href: string }>;
  page?: number;
  perPage?: number;
  total?: number;
}

export interface TrustpilotBusinessUnit {
  id: string;
  name: string;
  displayName?: string;
  identifyingName?: string;
  stars?: number;
  trustScore?: number;
  numberOfReviews?: {
    total?: number;
    fiveStars?: number;
    fourStars?: number;
    threeStars?: number;
    twoStars?: number;
    oneStar?: number;
  };
}

/**
 * Finds a Trustpilot Business Unit ID by domain name.
 */
export async function findTrustpilotBusinessUnit({
  domain,
  apiKey,
}: {
  domain: string;
  apiKey?: string;
}): Promise<TrustpilotBusinessUnit> {
  const key = apiKey || process.env.TRUSTPILOT_API_KEY;
  if (!key) {
    throw new Error(
      "Trustpilot API Key is required. Please provide an API key in credentials or configure TRUSTPILOT_API_KEY."
    );
  }

  // Clean domain name: strip protocol and trailing slashes
  const cleanDomain = domain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim();

  const url = `https://api.trustpilot.com/v1/business-units/find?name=${encodeURIComponent(cleanDomain)}`;

  const response = await fetch(url, {
    headers: {
      apikey: key,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Trustpilot API error finding business unit for "${domain}": ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetches reviews from Trustpilot Business API with pagination support.
 */
export async function fetchTrustpilotReviews({
  businessUnitId,
  apiKey,
  page = 1,
  perPage = 20,
}: {
  businessUnitId: string;
  apiKey?: string;
  page?: number;
  perPage?: number;
}): Promise<{
  businessUnitId: string;
  page: number;
  perPage: number;
  total?: number;
  reviews: NormalizedReview[];
}> {
  const key = apiKey || process.env.TRUSTPILOT_API_KEY;
  if (!key) {
    throw new Error(
      "Trustpilot API Key is required. Please provide an API key in credentials or configure TRUSTPILOT_API_KEY."
    );
  }

  if (!businessUnitId) {
    throw new Error("Trustpilot Business Unit ID is required.");
  }

  const url = new URL(
    `https://api.trustpilot.com/v1/business-units/${encodeURIComponent(businessUnitId)}/reviews`
  );
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(Math.min(perPage, 50)));

  const response = await fetch(url.toString(), {
    headers: {
      apikey: key,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Trustpilot API HTTP error: ${response.status} ${response.statusText}`
    );
  }

  const data: TrustpilotReviewsResponse = await response.json();
  const rawReviews = data.reviews || [];

  const normalized: NormalizedReview[] = rawReviews.map((item) => {
    // Combine title and text if title exists and differs
    let fullText = item.text || "";
    if (item.title && !fullText.startsWith(item.title)) {
      fullText = item.title ? `${item.title}\n\n${fullText}` : fullText;
    }

    return {
      providerReviewId: `trustpilot_${item.id}`,
      authorName: item.consumer?.displayName || "Trustpilot Reviewer",
      authorPhotoUrl: item.consumer?.profileImageUrl || null,
      rating: Math.max(1, Math.min(5, Math.round(item.stars || 5))),
      text: fullText.trim(),
      reviewDate: new Date(item.createdAt),
    };
  });

  return {
    businessUnitId,
    page: data.page || page,
    perPage: data.perPage || perPage,
    total: data.total,
    reviews: normalized,
  };
}

export interface ProviderStats {
  rating: number;
  total: number;
}

/**
 * Overall TrustScore and review count for a business, as Trustpilot reports them. Returns null
 * when the response does not contain both numbers, so callers can skip the stats instead of failing.
 */
export async function fetchTrustpilotStats({
  businessUnitId,
  apiKey,
}: {
  businessUnitId: string;
  apiKey?: string;
}): Promise<ProviderStats | null> {
  const key = apiKey || process.env.TRUSTPILOT_API_KEY;
  if (!key || !businessUnitId) return null;
  const response = await fetch(`https://api.trustpilot.com/v1/business-units/${encodeURIComponent(businessUnitId)}`, {
    headers: { apikey: key, Accept: "application/json" },
  });
  if (!response.ok) return null;
  return parseTrustpilotStats(await response.json().catch(() => null));
}

/**
 * Reads the TrustScore and review count out of a business-unit response. Trustpilot has shipped this
 * in more than one shape (`score.trustScore` / `numberOfReviews.total`, or flat `trustScore` /
 * `numberOfReviews`), so each known place is tried. Anything else returns null, never a wrong number.
 */
export function parseTrustpilotStats(data: unknown): ProviderStats | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const score = d.score && typeof d.score === "object" ? (d.score as Record<string, unknown>) : {};
  const count = d.numberOfReviews && typeof d.numberOfReviews === "object" ? (d.numberOfReviews as Record<string, unknown>) : {};
  const rating = num(score.trustScore) ?? num(d.trustScore);
  const total = num(count.total) ?? num(d.numberOfReviews);
  if (rating === null || total === null || total < 1 || rating < 0 || rating > 5) return null;
  return { rating, total };
}
