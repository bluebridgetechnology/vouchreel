import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGoogleReviews } from "../google";
import { fetchTrustpilotReviews, fetchTrustpilotStats, findTrustpilotBusinessUnit } from "../trustpilot";
import { connectReviewSourceSchema } from "@/lib/validations/reviews";

/**
 * The platform holds no Google or Trustpilot key: every call uses the key the owner gave for their own source.
 */
describe("review providers use only the owner's own key", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ignores any key in the server environment, and does not call the provider without the owner's", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "platform-google-key");
    vi.stubEnv("TRUSTPILOT_API_KEY", "platform-trustpilot-key");

    await expect(fetchGoogleReviews({ placeId: "p" })).rejects.toThrow(/no API key.*your own/i);
    await expect(fetchTrustpilotReviews({ businessUnitId: "b" })).rejects.toThrow(/no API key.*your own/i);
    await expect(findTrustpilotBusinessUnit({ domain: "example.com" })).rejects.toThrow(/no API key/i);
    expect(await fetchTrustpilotStats({ businessUnitId: "b" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the owner's key, and only that", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ status: "OK", result: { reviews: [] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "platform-google-key");
    await fetchGoogleReviews({ placeId: "p", apiKey: "owner-key" });
    const calls = fetchSpy.mock.calls as unknown as [string][];
    expect(calls[0][0]).toContain("key=owner-key");
    expect(calls[0][0]).not.toContain("platform-google-key");
  });

  it("connecting a source requires the owner's key", () => {
    expect(connectReviewSourceSchema.safeParse({ provider: "google", providerBusinessId: "p" }).success).toBe(false);
    expect(connectReviewSourceSchema.safeParse({ provider: "trustpilot", providerBusinessId: "b", apiKey: "  " }).success).toBe(false);
    expect(connectReviewSourceSchema.safeParse({ provider: "google", providerBusinessId: "p", apiKey: " k " })).toMatchObject({ success: true, data: { apiKey: "k" } });
  });
});
