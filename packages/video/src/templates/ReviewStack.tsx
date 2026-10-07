import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SourceMark } from "../components/SourceMark";
import { Avatar, Stars, WordReveal, clamped, useFadeIn, useLayout, useOutro } from "../components/primitives";
import { STACK_HEADER_SECONDS, stackItemSeconds } from "../registry";
import { bodyFont, mix } from "../lib/theme";
import { getVideoFont } from "../lib/font-catalog";
import { tint } from "../lib/palette";
import { usePalette } from "../lib/usePalette";
import type { ReviewVideoProps } from "../types";

/** The cards are always white, so their text colours are fixed; the background around them follows the style. */
const INK = "#1c1917";
const MUTED = "#78716c";

const textSize = (n: number) => (n <= 100 ? 56 : n <= 170 ? 48 : 41);

/** 3 to 5 short reviews, each card landing on top of the last like a wall of love. */
export const ReviewStack: React.FC<ReviewVideoProps> = (props) => {
  const { reviews } = props;
  const palette = usePalette(props, "gradient");
  const { u, portrait, fps } = useLayout();
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const outro = useOutro(durationInFrames, 0.6);
  const header = useFadeIn(0.1, 0.7);

  const starts: number[] = [];
  let t = STACK_HEADER_SECONDS;
  for (const r of reviews) {
    starts.push(t);
    t += stackItemSeconds(r.text);
  }

  const entrance = (i: number) => Math.max(0, spring({ frame: frame - starts[i] * fps, fps, config: { damping: 15, stiffness: 95 } }));
  const nowSeconds = frame / fps;
  const active = starts.reduce((acc, s, i) => (s <= nowSeconds ? i : acc), -1);

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont(props.theme?.font), opacity: outro }}>
      <Backdrop palette={palette} secondary={props.theme?.secondary} />

      <div
        style={{
          position: "absolute",
          top: (portrait ? 150 : 70) * u,
          width: "100%",
          textAlign: "center",
          color: palette.text,
          fontSize: (portrait ? 64 : 54) * u,
          fontWeight: 600,
          letterSpacing: -0.5,
          opacity: header,
          transform: `translateY(${(1 - header) * -30 * u}px)`,
        }}
      >
        What customers say
      </div>

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: (portrait ? 80 : 90) * u }}>
        <div style={{ position: "relative", width: (portrait ? 900 : 1260) * u, height: 0 }}>
          {reviews.map((review, i) => {
            if (i > active) return null;
            const enter = entrance(i);
            // how far later cards have already pushed this one back (fractional while they animate in)
            let shift = 0;
            for (let j = i + 1; j <= active; j++) shift += entrance(j);
            const size = textSize(review.text.length) * getVideoFont(props.theme?.font).sizeScale * u * (portrait ? 1 : 0.9);

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  transform: `translateY(calc(-50% + ${(1 - enter) * 190 * u - Math.min(shift, 2.6) * 92 * u}px)) scale(${(0.93 + 0.07 * enter) * (1 - 0.07 * Math.min(shift, 2.6))})`,
                  // Older cards stay opaque (so no text shows through) but tint toward the background
                  opacity: enter * interpolate(shift, [0, 2.2, 3], [1, 1, 0], clamped),
                  zIndex: i,
                  background: shift > 0 ? mix("#ffffff", palette.accent, Math.min(shift, 2.2) * 0.2) : "#ffffff",
                  borderRadius: 44 * u,
                  padding: (portrait ? 62 : 56) * u,
                  boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,0.35)`,
                }}
              >
                <div style={{ opacity: interpolate(shift, [0, 0.45], [1, 0], clamped) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 * u }}>
                    {review.rating != null && <Stars rating={review.rating} size={42 * u} emptyColor="rgba(0,0,0,0.12)" startSeconds={starts[i] + 0.2} />}
                    <SourceMark source={review.source} domain={review.link} u={u * 0.85} onDark={false} />
                  </div>
                  <WordReveal
                    text={review.text}
                    startSeconds={starts[i] + 0.8}
                    wordsPerSecond={4.8}
                    gap={size * 0.25}
                    style={{ color: INK, fontSize: size, lineHeight: 1.3, fontWeight: 500, letterSpacing: -0.3 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 22 * u, marginTop: 34 * u }}>
                    <Avatar name={review.author} size={70 * u} background={palette.accent} color="#ffffff" />
                    <div>
                      <div style={{ color: INK, fontSize: 36 * u, fontWeight: 600 }}>{review.author}</div>
                      {review.date && <div style={{ color: MUTED, fontSize: 26 * u, marginTop: 2 * u }}>{review.date}</div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* progress dots */}
      <div style={{ position: "absolute", bottom: (portrait ? 150 : 60) * u, width: "100%", display: "flex", justifyContent: "center", gap: 16 * u }}>
        {reviews.map((_, i) => (
          <div
            key={i}
            style={{
              width: (i === active ? 46 : 16) * u,
              height: 16 * u,
              borderRadius: 999,
              background: i <= active ? palette.text : tint(palette, 0.3),
              opacity: i === active ? 1 : 0.6,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
