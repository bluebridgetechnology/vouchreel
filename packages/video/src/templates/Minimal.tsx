import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Orb, Stars, WordReveal, clamped, fitFontSize, useFadeIn, useLayout, useOutro } from "../components/primitives";
import { SourceMark } from "../components/SourceMark";
import { FONT_SANS, FONT_SERIF, darken, rgba } from "../lib/theme";
import type { ReviewVideoProps } from "../types";

const PAPER = "#faf6ef";
const INK = "#1f1a14";
const MUTED = "#6b6257";

/** Clean light layout with an elegant serif quote. */
export const Minimal: React.FC<ReviewVideoProps> = ({ reviews, brand }) => {
  const review = reviews[0];
  const { u, portrait } = useLayout();
  const { durationInFrames, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Stars use a darker shade so they stay visible on the light background
  const accent = darken(brand, 0.12);
  const wordsPerSecond = 4.2;
  const revealStart = 0.9;
  const revealEnd = revealStart + review.text.split(/\s+/).length / wordsPerSecond;
  const ruleWidth = interpolate(frame, [0.1 * fps, 0.9 * fps], [0, 1], { ...clamped });
  const authorIn = useFadeIn(revealEnd - 0.3, 0.7);
  const head = useFadeIn(0.1, 0.7);
  const outro = useOutro(durationInFrames);
  const fontSize = fitFontSize(review.text, portrait) * 0.92 * u;

  return (
    <AbsoluteFill style={{ background: PAPER, fontFamily: FONT_SANS, opacity: outro }}>
      <Orb size={1100 * u} color={rgba(brand, 0.08)} top={-420 * u} right={-380 * u} drift={0.03} />
      <Orb size={520 * u} color={rgba(brand, 0.06)} bottom={-160 * u} left={-140 * u} phase={1.5} drift={0.03} />

      <AbsoluteFill style={{ justifyContent: "center", padding: (portrait ? 110 : 190) * u }}>
        <div style={{ maxWidth: (portrait ? 860 : 1380) * u }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 * u, opacity: head }}>
            <Stars rating={review.rating} size={44 * u} color={accent} emptyColor="rgba(31,26,20,0.14)" startSeconds={0.2} />
            <SourceMark source={review.source} u={u} onDark={false} textColor={MUTED} />
          </div>

          <div style={{ height: 3 * u, width: 150 * u * ruleWidth, background: accent, margin: `${38 * u}px 0 ${44 * u}px` }} />

          <WordReveal
            text={review.text}
            startSeconds={revealStart}
            wordsPerSecond={wordsPerSecond}
            gap={fontSize * 0.24}
            style={{ color: INK, fontSize, lineHeight: 1.32, fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 500, letterSpacing: -0.3 }}
          />

          <div style={{ marginTop: 58 * u, opacity: authorIn, transform: `translateY(${(1 - authorIn) * 24 * u}px)` }}>
            <div style={{ color: INK, fontSize: 42 * u, fontWeight: 500 }}>{review.author}</div>
            {review.date && <div style={{ color: MUTED, fontSize: 30 * u, marginTop: 6 * u }}>{review.date}</div>}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
