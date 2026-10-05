import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Avatar, Stars, WordReveal, fitFontSize, useFadeIn, useLayout, useOutro, useSpringIn } from "../components/primitives";
import { SourceMark } from "../components/SourceMark";
import { FONT_SANS, lighten, rgba } from "../lib/theme";
import type { ReviewVideoProps } from "../types";

const NIGHT = "#0b0d12";
const CARD = "#151922";

/** Dark theme with a glowing accent and a floating review card. */
export const DarkCard: React.FC<ReviewVideoProps> = ({ reviews, brand }) => {
  const review = reviews[0];
  const { u, portrait, width, height } = useLayout();
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const glow = lighten(brand, 0.1);
  const cardIn = useSpringIn(0.1, { damping: 15, stiffness: 80 });
  const wordsPerSecond = 4.4;
  const revealStart = 1.0;
  const revealEnd = revealStart + review.text.split(/\s+/).length / wordsPerSecond;
  const footerIn = useFadeIn(revealEnd - 0.2, 0.6);
  const outro = useOutro(durationInFrames);
  const fontSize = fitFontSize(review.text, portrait) * 0.86 * u;

  // The glow drifts slowly; the card floats a few pixels
  const gx = 50 + Math.sin(frame / 90) * 12;
  const gy = 35 + Math.cos(frame / 110) * 10;
  const float = Math.sin(frame / 38) * 7 * u;

  return (
    <AbsoluteFill style={{ background: NIGHT, fontFamily: FONT_SANS, opacity: outro }}>
      <AbsoluteFill style={{ background: `radial-gradient(${Math.max(width, height) * 0.62}px at ${gx}% ${gy}%, ${rgba(glow, 0.55)} 0%, ${rgba(brand, 0.18)} 45%, transparent 75%)` }} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: (portrait ? 70 : 150) * u }}>
        <div
          style={{
            width: "100%",
            maxWidth: (portrait ? 940 : 1340) * u,
            background: CARD,
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 48 * u,
            padding: (portrait ? 70 : 78) * u,
            boxShadow: `0 ${40 * u}px ${120 * u}px rgba(0,0,0,0.55), 0 0 ${90 * u}px ${rgba(brand, 0.22)}`,
            opacity: cardIn,
            transform: `translateY(${(1 - cardIn) * 120 * u + float}px) scale(${0.92 + cardIn * 0.08})`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 * u, marginBottom: 46 * u }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 * u }}>
              <Avatar name={review.author} size={84 * u} background={rgba(brand, 0.9)} color="#ffffff" />
              <div>
                <div style={{ color: "#f4f5f7", fontSize: 40 * u, fontWeight: 600 }}>{review.author}</div>
                {review.date && <div style={{ color: "#8b94a7", fontSize: 28 * u, marginTop: 4 * u }}>{review.date}</div>}
              </div>
            </div>
            <Stars rating={review.rating} size={44 * u} emptyColor="rgba(255,255,255,0.16)" startSeconds={0.5} />
          </div>

          <WordReveal
            text={review.text}
            startSeconds={revealStart}
            wordsPerSecond={wordsPerSecond}
            gap={fontSize * 0.25}
            style={{ color: "#eceef2", fontSize, lineHeight: 1.34, fontWeight: 500, letterSpacing: -0.3 }}
          />

          <div style={{ marginTop: 50 * u, opacity: footerIn }}>
            <SourceMark source={review.source} u={u} onDark />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
