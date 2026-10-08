export interface GooglePlaceReview {
  author_name: string;
  author_url?: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description?: string;
  text?: string;
  time: number;
}

export interface GooglePlaceDetailsResponse {
  result?: {
    name?: string;
    place_id?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: GooglePlaceReview[];
  };
  status: string;
  error_message?: string;
}

export interface NormalizedReview {
  providerReviewId: string;
  authorName: string;
  authorPhotoUrl?: string | null;
  rating: number;
  text: string;
  reviewDate: Date;
}

/**
 * Fetches reviews for a Google Place ID using Google Places Details API.
 * Google Places API officially returns up to the 5 most helpful/recent reviews.
 */
export async function fetchGoogleReviews({
  placeId,
  apiKey,
}: {
  placeId: string;
  apiKey?: string;
}): Promise<{
  placeName?: string;
  rating?: number;
  totalReviews?: number;
  reviews: NormalizedReview[];
}> {
  // The owner's own key: the platform holds no Google key of its own
  const key = apiKey;
  if (!key) {
    throw new Error("This Google source has no API key. Reconnect it and add your own Google Places API key.");
  }

  if (!placeId) {
    throw new Error("Google Place ID is required.");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "name,place_id,rating,user_ratings_total,reviews"
  );
  url.searchParams.set("key", key);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Google Places API HTTP error: ${response.status} ${response.statusText}`);
  }

  const data: GooglePlaceDetailsResponse = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Places API returned status "${data.status}": ${data.error_message || "Unknown error"}`
    );
  }

  const rawReviews = data.result?.reviews || [];
  const normalized: NormalizedReview[] = rawReviews.map((r) => {
    // Generate a stable unique ID for the review
    const safeAuthor = (r.author_name || "anonymous")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");
    const providerReviewId = `google_${placeId}_${r.time}_${safeAuthor}`;

    return {
      providerReviewId,
      authorName: r.author_name || "Anonymous",
      authorPhotoUrl: r.profile_photo_url || null,
      rating: Math.max(1, Math.min(5, Math.round(r.rating || 5))),
      text: r.text || "",
      reviewDate: new Date(r.time * 1000),
    };
  });

  return {
    placeName: data.result?.name,
    rating: data.result?.rating,
    totalReviews: data.result?.user_ratings_total,
    reviews: normalized,
  };
}
