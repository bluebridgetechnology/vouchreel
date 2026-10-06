import { describe, expect, it } from "vitest";
import { parseTrustpilotStats } from "../trustpilot";

describe("parseTrustpilotStats", () => {
  it("reads the nested shape", () => {
    expect(parseTrustpilotStats({ score: { trustScore: 4.6 }, numberOfReviews: { total: 120 } })).toEqual({ rating: 4.6, total: 120 });
  });
  it("reads the flat shape", () => {
    expect(parseTrustpilotStats({ trustScore: 4.1, numberOfReviews: 33 })).toEqual({ rating: 4.1, total: 33 });
  });
  it("returns null, never a wrong number, for anything it does not recognise", () => {
    for (const bad of [null, "x", 5, [], {}, { score: {} }, { score: { trustScore: "4.6" }, numberOfReviews: { total: 3 } }, { score: { trustScore: 4 }, numberOfReviews: { total: 0 } }, { score: { trustScore: 9 }, numberOfReviews: { total: 5 } }, { score: { trustScore: Number.NaN }, numberOfReviews: { total: 5 } }]) {
      expect(parseTrustpilotStats(bad)).toBeNull();
    }
  });
});
