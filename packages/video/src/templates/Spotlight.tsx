import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Avatar, Orb, SourceBadge, Stars, WordReveal, fitFontSize, useLayout, useOutro, useSpringIn } from "../components/primitives";
import { FONT_SANS, brandForWhiteText, darken, lighten } from "../lib/theme";
import type { ReviewVideoProps } from "../types";

/** Bold brand gradient, stars pop in, the review types out word by word. */
export const Spotlight: React.FC<ReviewVideoProps> = ({ reviews, brand }) => {
  const review = reviews[0];
  const { u, portrait } = useLayout();
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const base = brandForWhiteText(brand);
  const angle = 135 + interpolate(frame, [0, durationInFrames], [0, 40]);
  const background = `linear-gradient(${angle}deg, ${base} 0%, ${darken(base, 0.55)} 100%)`;

  const cardIn = useSpringIn(0, { damping: 18, stiffness: 90 });
  const wordsPerSecond = 4.6;
  const revealEnd = 1.2 + review.text.split(/\s+/).length / wordsPerSecond;
  const authorIn = useSpringIn(revealEnd - 0.4, { damping: 16 });
  const outro = useOutro(durationInFrames);
  const fontSize = fitFontSize(review.text, portrait) * u;

  return (
    <AbsoluteFill style={{ background, fontFamily: FONT_SANS, opacity: outro }}>
      <Orb size={900 * u} color="rgba(255,255,255,0.07)" top={-280 * u} right={-260 * u} />
      <Orb size={700 * u} color="rgba(0,0,0,0.14)" bottom={-240 * u} left={-220 * u} phase={2} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: (portrait ? 90 : 160) * u }}>
        <div
          style={{
            width: "100%",
            maxWidth: (portrait ? 900 : 1500) * u,
            opacity: cardIn,
            transform: `translateY(${(1 - cardIn) * 80 * u}px) scale(${0.94 + cardIn * 0.06})`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 * u, marginBottom: 44 * u }}>
            <SourceBadge source={review.source} u={u} background="rgba(255,255,255,0.18)" color="#ffffff" />
            <Stars rating={review.rating} size={54 * u} />
          </div>

          <div style={{ fontSize: 200 * u, lineHeight: 0.6, height: 100 * u, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>“</div>

          <WordReveal
            text={review.text}
            startSeconds={1.2}
            wordsPerSecond={wordsPerSecond}
            gap={fontSize * 0.26}
            style={{ color: "#ffffff", fontSize, lineHeight: 1.28, fontWeight: 600, letterSpacing: -0.5 }}
          />

          <div
            style={{
              marginTop: 52 * u,
              display: "flex",
              alignItems: "center",
              gap: 26 * u,
              opacity: authorIn,
              transform: `translateY(${(1 - authorIn) * 40 * u}px)`,
            }}
          >
            <Avatar name={review.author} size={92 * u} background="rgba(255,255,255,0.94)" color={base} />
            <div>
              <div style={{ color: "#ffffff", fontSize: 42 * u, fontWeight: 600 }}>{review.author}</div>
              {review.date && <div style={{ color: lighten(base, 0.7), fontSize: 30 * u, marginTop: 4 * u }}>{review.date}</div>}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
