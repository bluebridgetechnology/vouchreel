import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SOURCE_LABELS, type ReviewSource } from "../types";
import { GOLD } from "../lib/theme";

export interface Layout {
  width: number;
  height: number;
  portrait: boolean;
  /** Scale factor: design values below are written for a 1080px short side. */
  u: number;
  fps: number;
}

export function useLayout(): Layout {
  const { width, height, fps } = useVideoConfig();
  const portrait = height > width;
  return { width, height, portrait, u: Math.min(width, height) / 1080, fps };
}

/**
 * Font size (in 1080-based px) that keeps a whole review on screen. Reviews are shown in full,
 * so long ones get smaller type instead of being shortened.
 */
export function fitFontSize(text: string, portrait: boolean): number {
  const n = text.length;
  const base = n <= 90 ? 74 : n <= 160 ? 64 : n <= 240 ? 55 : n <= 320 ? 48 : 42;
  return portrait ? base : Math.round(base * 0.92);
}

export const clamped = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 to 1 over `seconds` starting at `startSeconds`, eased out. */
export function useFadeIn(startSeconds: number, seconds = 0.6): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [startSeconds * fps, (startSeconds + seconds) * fps], [0, 1], {
    ...clamped,
    easing: Easing.out(Easing.cubic),
  });
}

/** Spring that starts at `startSeconds`. */
export function useSpringIn(startSeconds: number, config: { damping?: number; stiffness?: number; mass?: number } = {}): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return Math.max(0, spring({ frame: frame - startSeconds * fps, fps, config: { damping: 16, stiffness: 100, ...config } }));
}

/** Fades the whole composition out over the last `seconds`. */
export function useOutro(totalFrames: number, seconds = 0.5): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [totalFrames - seconds * fps, totalFrames], [1, 0], clamped);
}

const STAR_PATH = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z";

export function Stars({
  rating,
  size,
  color = GOLD,
  emptyColor = "rgba(255,255,255,0.28)",
  startSeconds = 0.3,
  gap,
}: {
  rating: number;
  size: number;
  color?: string;
  emptyColor?: string;
  startSeconds?: number;
  gap?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div role="img" aria-label={`${rating} out of 5 stars`} style={{ display: "flex", gap: gap ?? size * 0.14 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const pop = Math.max(0, spring({ frame: frame - (startSeconds + n * 0.11) * fps, fps, config: { damping: 9, stiffness: 170 } }));
        // Fractional ratings (4.8) fill the last star partially
        const fill = Math.min(1, Math.max(0, rating - (n - 1)));
        const clipId = `star-clip-${n}-${Math.round(rating * 10)}`;
        return (
          <div key={n} style={{ transform: `scale(${pop}) rotate(${(1 - pop) * -40}deg)` }}>
            <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
              <defs>
                <clipPath id={clipId}>
                  <rect x="0" y="0" width={24 * fill} height="24" />
                </clipPath>
              </defs>
              <path d={STAR_PATH} fill={emptyColor} />
              <path d={STAR_PATH} fill={color} clipPath={`url(#${clipId})`} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

/** Text-only source label. Provider logos are deliberately not used (brand rules). */
export function SourceBadge({
  source,
  u,
  background,
  color,
}: {
  source: ReviewSource;
  u: number;
  background: string;
  color: string;
}) {
  return (
    <div
      style={{
        background,
        color,
        fontSize: 30 * u,
        fontWeight: 600,
        padding: `${11 * u}px ${26 * u}px`,
        borderRadius: 999,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {SOURCE_LABELS[source]}
    </div>
  );
}

/** Reveals `text` word by word. The text itself is passed through untouched. */
export function WordReveal({
  text,
  startSeconds,
  wordsPerSecond,
  gap,
  style,
}: {
  text: string;
  startSeconds: number;
  wordsPerSecond: number;
  gap: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Keep the author's line breaks; split into words per line
  const lines = text.split(/\n+/);
  let index = 0;
  return (
    <p style={{ margin: 0, ...style }}>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 && <br />}
          {line
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => {
              const i = index++;
              const appearAt = (startSeconds + i / wordsPerSecond) * fps;
              const t = interpolate(frame, [appearAt, appearAt + 8], [0, 1], { ...clamped, easing: Easing.out(Easing.cubic) });
              return (
                <span key={i} style={{ display: "inline-block", marginRight: gap, opacity: t, transform: `translateY(${(1 - t) * 18}px)` }}>
                  {word}
                </span>
              );
            })}
        </React.Fragment>
      ))}
    </p>
  );
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => Array.from(p)[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function Avatar({ name, size, background, color }: { name: string; size: number; background: string; color: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

/** Soft drifting circles used as decoration. */
export function Orb({
  size,
  color,
  top,
  left,
  right,
  bottom,
  drift = 0.04,
  phase = 0,
}: {
  size: number;
  color: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  drift?: number;
  phase?: number;
}) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        top,
        left,
        right,
        bottom,
        transform: `translateY(${Math.sin(frame / 45 + phase) * size * drift}px) scale(${1 + Math.sin(frame / 60 + phase) * 0.03})`,
      }}
    />
  );
}
