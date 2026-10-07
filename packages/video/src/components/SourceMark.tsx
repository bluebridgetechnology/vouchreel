import React from "react";
import { Img } from "remotion";
import googleIcon from "../assets/google-icon.svg";
import trustpilotLogo from "../assets/trustpilot-logo.svg";
import { SOURCE_LABELS, type ReviewSource } from "../types";

/**
 * The review source shown with its official logo. The logo files in ../assets are used exactly as
 * supplied (a test checks their hashes): they are never recoloured, redrawn or stretched. On a
 * coloured or dark background they sit on a white chip, so they keep their own colours.
 */

/**
 * Bundlers differ on what `import x from "./a.svg"` returns: Remotion's webpack gives the URL as a
 * string, while Next.js (the dashboard preview) gives an object with a `src`.
 */
const assetUrl = (asset: unknown): string => (typeof asset === "string" ? asset : (asset as { src: string }).src);

/** Intrinsic proportions of the two SVG files (viewBox width / height). */
export const GOOGLE_ASPECT = 268.1522 / 273.8827;
export const TRUSTPILOT_ASPECT = 1132.8 / 278.2;

/** Dark grey Google uses for its own text; readable on the white chip. */
const CHIP_TEXT = "#3c4043";

export interface MarkLayout {
  /** White chip behind the logo (needed on coloured or dark backgrounds). */
  chip: boolean;
  /** Text next to the logo. The Trustpilot logo already contains the name, so it has none. */
  label: string | null;
}

export function markLayout(source: ReviewSource, onDark: boolean): MarkLayout {
  return { chip: onDark, label: source === "google" ? SOURCE_LABELS.google : null };
}

export function SourceMark({
  source,
  u,
  onDark,
  textColor = "#44403c",
  size = 1,
  domain,
}: {
  source: ReviewSource;
  /** Owner-supplied reviews: the site domain to show instead of a logo (nothing is drawn without one). */
  domain?: string;
  /** Layout scale factor (see useLayout). */
  u: number;
  /** True when the background is coloured or dark: puts the logo on a white chip. */
  onDark: boolean;
  /** Label colour when there is no chip. */
  textColor?: string;
  size?: number;
}) {
  if (source === "own") {
    return domain ? <span style={{ fontSize: 30 * u * size, fontWeight: 500, color: onDark ? "rgba(255,255,255,0.8)" : textColor, whiteSpace: "nowrap" }}>{domain}</span> : null;
  }
  const { chip, label } = markLayout(source, onDark);
  const height = 38 * u * size;
  const logo =
    source === "google" ? (
      <Img src={assetUrl(googleIcon)} alt="Google" style={{ height, width: height * GOOGLE_ASPECT, display: "block" }} />
    ) : (
      <Img src={assetUrl(trustpilotLogo)} alt="Trustpilot" style={{ height: height * 1.25, width: height * 1.25 * TRUSTPILOT_ASPECT, display: "block" }} />
    );

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14 * u * size,
        flexShrink: 0,
        whiteSpace: "nowrap",
        ...(chip
          ? { background: "#ffffff", padding: `${10 * u * size}px ${24 * u * size}px`, borderRadius: 999 }
          : {}),
      }}
    >
      {logo}
      {label && <span style={{ fontSize: 30 * u * size, fontWeight: 500, color: chip ? CHIP_TEXT : textColor, letterSpacing: 0.2 }}>{label}</span>}
    </div>
  );
}
