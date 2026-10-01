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
