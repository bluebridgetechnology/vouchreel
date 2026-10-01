/**
 * Statistical significance calculation for A/B testing experiments using
 * two-proportion pooled z-test.
 */

export interface VariantMetrics {
  impressions: number;
  conversions: number;
  plays?: number;
  clicks?: number;
}

export interface ZTestResult {
  zScore: number;
  pValue: number;
  confidence: number | null;
  isSignificant: boolean;
  relativeUplift: number;
  message: string;
  sampleSizeMet: boolean;
  controlRate: number;
  variantRate: number;
  pooledProportion: number;
  standardError: number;
}

export const MIN_SAMPLE_IMPRESSIONS = 30;
export const MIN_SAMPLE_CONVERSIONS = 3;
export const SIGNIFICANCE_ALPHA = 0.05; // 95% confidence threshold

/**
 * Standard error function approximation (Abramowitz & Stegun 7.1.26).
 * Maximum error is less than 1.5e-7.
 */
export function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Standard normal cumulative distribution function (CDF) for standard normal N(0, 1).
 */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Calculates two-proportion pooled z-test between control and variant.
 *
 * Checks minimum sample size threshold (impressions >= 30, conversions >= 3).
 * If insufficient, returns confidence: null, isSignificant: false, message: "Collecting data".
 */
export function calculateZTest(
  control: { impressions: number; conversions: number },
  variant: { impressions: number; conversions: number }
): ZTestResult {
  const n1 = Math.max(0, Number(control?.impressions) || 0);
  const x1 = Math.max(0, Number(control?.conversions) || 0);
  const n2 = Math.max(0, Number(variant?.impressions) || 0);
  const x2 = Math.max(0, Number(variant?.conversions) || 0);

  const p1 = n1 > 0 ? x1 / n1 : 0;
  const p2 = n2 > 0 ? x2 / n2 : 0;

  const relativeUplift = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0;
  const roundedUplift = Math.round(relativeUplift * 10) / 10;

  // Minimum sample size check
  if (
    n1 < MIN_SAMPLE_IMPRESSIONS ||
    n2 < MIN_SAMPLE_IMPRESSIONS ||
    x1 < MIN_SAMPLE_CONVERSIONS ||
    x2 < MIN_SAMPLE_CONVERSIONS
  ) {
    return {
      zScore: 0,
      pValue: 1,
      confidence: null,
      isSignificant: false,
      relativeUplift: roundedUplift,
      message: "Collecting data",
      sampleSizeMet: false,
      controlRate: p1,
      variantRate: p2,
      pooledProportion: 0,
      standardError: 0,
    };
  }

  // Pooled proportion
  const p = (x1 + x2) / (n1 + n2);
  const variance = p * (1 - p) * (1 / n1 + 1 / n2);
  const standardError = Math.sqrt(Math.max(0, variance));

  if (standardError === 0) {
    return {
      zScore: 0,
      pValue: 1,
      confidence: null,
      isSignificant: false,
      relativeUplift: roundedUplift,
      message: "No variance observed",
      sampleSizeMet: true,
      controlRate: p1,
      variantRate: p2,
      pooledProportion: p,
      standardError: 0,
    };
  }

  const zScore = (p2 - p1) / standardError;
  const absZ = Math.abs(zScore);
  const pValue = Math.max(0, Math.min(1, 2 * (1 - normalCdf(absZ))));
  const confidence = Math.round((1 - pValue) * 1000) / 10; // e.g. 97.4
  const isSignificant = pValue < SIGNIFICANCE_ALPHA;

  const upliftFormatted =
    roundedUplift >= 0 ? `+${roundedUplift.toFixed(1)}%` : `${roundedUplift.toFixed(1)}%`;

  let message = "No statistically significant difference detected yet";
  if (isSignificant) {
    if (zScore > 0) {
      message = `${Math.round(confidence)}% Confidence — Variant is outperforming Control by ${upliftFormatted}`;
    } else {
      message = `${Math.round(confidence)}% Confidence — Variant is underperforming Control by ${upliftFormatted}`;
    }
  }

  return {
    zScore: Math.round(zScore * 1000) / 1000,
    pValue: Math.round(pValue * 10000) / 10000,
    confidence,
    isSignificant,
    relativeUplift: roundedUplift,
    message,
    sampleSizeMet: true,
    controlRate: p1,
    variantRate: p2,
    pooledProportion: p,
    standardError,
  };
}
