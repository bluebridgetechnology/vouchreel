import { describe, it, expect } from "vitest";
import {
  calculateZTest,
  erf,
  normalCdf,
  MIN_SAMPLE_IMPRESSIONS,
  MIN_SAMPLE_CONVERSIONS,
} from "../stats";

describe("A/B Testing Statistical Significance Engine (z-test)", () => {
  describe("erf and normalCdf", () => {
    it("approximates erf(0) to 0 and erf(infinity) near 1", () => {
      expect(erf(0)).toBeCloseTo(0, 5);
      expect(erf(3)).toBeCloseTo(0.99997, 3);
      expect(erf(-3)).toBeCloseTo(-0.99997, 3);
    });

    it("approximates standard normal cdf at critical values", () => {
      expect(normalCdf(0)).toBeCloseTo(0.5, 4);
      // z = 1.96 gives ~0.975 (one-tailed) -> 95% confidence two-tailed
      expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
      expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
    });
  });

  describe("Minimum Sample Size Threshold", () => {
    it("returns 'Collecting data' when control impressions < 30", () => {
      const res = calculateZTest(
        { impressions: 29, conversions: 5 },
        { impressions: 100, conversions: 10 }
      );
      expect(res.confidence).toBeNull();
      expect(res.isSignificant).toBe(false);
      expect(res.message).toBe("Collecting data");
      expect(res.sampleSizeMet).toBe(false);
    });

    it("returns 'Collecting data' when variant impressions < 30", () => {
      const res = calculateZTest(
        { impressions: 100, conversions: 10 },
        { impressions: 15, conversions: 5 }
      );
      expect(res.confidence).toBeNull();
      expect(res.isSignificant).toBe(false);
      expect(res.message).toBe("Collecting data");
      expect(res.sampleSizeMet).toBe(false);
    });

    it("returns 'Collecting data' when conversions < 3", () => {
      const res = calculateZTest(
        { impressions: 100, conversions: 2 },
        { impressions: 100, conversions: 10 }
      );
      expect(res.confidence).toBeNull();
      expect(res.isSignificant).toBe(false);
      expect(res.message).toBe("Collecting data");
      expect(res.sampleSizeMet).toBe(false);
    });

    it("handles zeros safely without dividing by zero", () => {
      const res = calculateZTest(
        { impressions: 0, conversions: 0 },
        { impressions: 0, conversions: 0 }
      );
      expect(res.confidence).toBeNull();
      expect(res.isSignificant).toBe(false);
      expect(res.message).toBe("Collecting data");
      expect(res.zScore).toBe(0);
      expect(res.pValue).toBe(1);
    });
  });

  describe("Z-Test Statistical Significance Calculation", () => {
    it("detects statistically significant winner (p < 0.01, confidence > 99%)", () => {
      // Control: 1000 impressions, 50 conversions (5%)
      // Variant: 1000 impressions, 85 conversions (8.5%)
      const res = calculateZTest(
        { impressions: 1000, conversions: 50 },
        { impressions: 1000, conversions: 85 }
      );

      expect(res.sampleSizeMet).toBe(true);
      expect(res.isSignificant).toBe(true);
      expect(res.confidence).toBeGreaterThanOrEqual(99);
      expect(res.pValue).toBeLessThan(0.01);
      expect(res.zScore).toBeGreaterThan(2.5);
      expect(res.relativeUplift).toBeCloseTo(70, 0); // (8.5 - 5) / 5 = +70%
      expect(res.message).toContain("Variant is outperforming Control");
    });

    it("detects inconclusive / not significant result with insufficient effect", () => {
      // Control: 200 impressions, 10 conversions (5%)
      // Variant: 200 impressions, 11 conversions (5.5%)
      const res = calculateZTest(
        { impressions: 200, conversions: 10 },
        { impressions: 200, conversions: 11 }
      );

      expect(res.sampleSizeMet).toBe(true);
      expect(res.isSignificant).toBe(false);
      expect(res.pValue).toBeGreaterThan(0.05);
      expect(res.confidence).toBeLessThan(95);
      expect(res.message).toBe("No statistically significant difference detected yet");
    });

    it("detects underperforming variant with negative z-score", () => {
      // Control: 1000 impressions, 80 conversions (8%)
      // Variant: 1000 impressions, 40 conversions (4%)
      const res = calculateZTest(
        { impressions: 1000, conversions: 80 },
        { impressions: 1000, conversions: 40 }
      );

      expect(res.sampleSizeMet).toBe(true);
      expect(res.isSignificant).toBe(true);
      expect(res.zScore).toBeLessThan(-2.5);
      expect(res.relativeUplift).toBeCloseTo(-50, 0);
      expect(res.message).toContain("Variant is underperforming Control");
    });

    it("handles identical conversion rates gracefully", () => {
      const res = calculateZTest(
        { impressions: 500, conversions: 25 },
        { impressions: 500, conversions: 25 }
      );

      expect(res.sampleSizeMet).toBe(true);
      expect(res.isSignificant).toBe(false);
      expect(res.zScore).toBe(0);
      expect(res.pValue).toBe(1);
      expect(res.relativeUplift).toBe(0);
    });
  });
});
