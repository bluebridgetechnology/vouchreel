import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SourceMark } from "../components/SourceMark";
import { Avatar, Stars, WordReveal, fitFontSize, useFadeIn, useLayout, useOutro, useSpringIn } from "../components/primitives";
import { bodyFont, rgba } from "../lib/theme";
import { usePalette } from "../lib/usePalette";
import type { ReviewVideoProps } from "../types";

/** The card surface is always dark, so its text colours are fixed; the background around it follows the style. */
const CARD = "#151922";
const CARD_TEXT = "#f4f5f7";
const CARD_BODY = "#eceef2";
const CARD_MUTED = "#8b94a7";

/** A dark floating card with a glowing accent. Dark background by default; works on any style. */
export const DarkCard: React.FC<ReviewVideoProps> = (props) => {
  const review = props.reviews[0];
  const palette = usePalette(props, "dark");
  const { u, portrait } = useLayout();
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const cardIn = useSpringIn(0.1, { damping: 15, stiffness: 80 });
  const wordsPerSecond = 4.4;
  const revealStart = 1.0;
  const revealEnd = revealStart + review.text.split(/\s+/).length / wordsPerSecond;
  const footerIn = useFadeIn(revealEnd - 0.2, 0.6);
  const outro = useOutro(durationInFrames);
  const fontSize = fitFontSize(review.text, portrait, props.theme?.font) * 0.86 * u;
  const float = Math.sin(frame / 38) * 7 * u;

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont(props.theme?.font), opacity: outro }}>
      <Backdrop palette={palette} secondary={props.theme?.secondary} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: (portrait ? 70 : 150) * u }}>
        <div
          style={{
            width: "100%",
            maxWidth: (portrait ? 940 : 1340) * u,
            background: CARD,
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 48 * u,
            padding: (portrait ? 70 : 78) * u,
            boxShadow: `0 ${40 * u}px ${120 * u}px rgba(0,0,0,0.55), 0 0 ${90 * u}px ${rgba(palette.accentOnDark, 0.22)}`,
            opacity: cardIn,
            transform: `translateY(${(1 - cardIn) * 120 * u + float}px) scale(${0.92 + cardIn * 0.08})`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 * u, marginBottom: 46 * u }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 * u }}>
              <Avatar name={review.author} size={84 * u} background={palette.accentOnDark} color={CARD} />
              <div>
                <div style={{ color: CARD_TEXT, fontSize: 40 * u, fontWeight: 600 }}>{review.author}</div>
                {review.date && <div style={{ color: CARD_MUTED, fontSize: 28 * u, marginTop: 4 * u }}>{review.date}</div>}
              </div>
            </div>
            {review.rating != null && <Stars rating={review.rating} size={44 * u} emptyColor="rgba(255,255,255,0.16)" startSeconds={0.5} />}
          </div>

          <WordReveal
            text={review.text}
            startSeconds={revealStart}
            wordsPerSecond={wordsPerSecond}
            gap={fontSize * 0.25}
            style={{ color: CARD_BODY, fontSize, lineHeight: 1.34, fontWeight: 500, letterSpacing: -0.3 }}
          />

          <div style={{ marginTop: 50 * u, opacity: footerIn }}>
            <SourceMark source={review.source} domain={review.link} u={u} onDark />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
