import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SourceMark } from "../components/SourceMark";
import { Avatar, Stars, WordReveal, fitFontSize, useLayout, useOutro, useSpringIn } from "../components/primitives";
import { FONT_SANS } from "../lib/theme";
import { tint } from "../lib/palette";
import { usePalette } from "../lib/usePalette";
import type { ReviewVideoProps } from "../types";

/** The review types out word by word over a bold background; stars pop in. */
export const Spotlight: React.FC<ReviewVideoProps> = (props) => {
  const review = props.reviews[0];
  const palette = usePalette(props, "gradient");
  const { u, portrait } = useLayout();
  const { durationInFrames } = useVideoConfig();

  const cardIn = useSpringIn(0, { damping: 18, stiffness: 90 });
  const wordsPerSecond = 4.6;
  const revealEnd = 1.2 + review.text.split(/\s+/).length / wordsPerSecond;
  const authorIn = useSpringIn(revealEnd - 0.4, { damping: 16 });
  const outro = useOutro(durationInFrames);
  const fontSize = fitFontSize(review.text, portrait) * u;

  return (
    <AbsoluteFill style={{ fontFamily: FONT_SANS, opacity: outro }}>
      <Backdrop palette={palette} secondary={props.theme?.secondary} />

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
            <SourceMark source={review.source} u={u} onDark={palette.style !== "light"} textColor={palette.text} />
            <Stars rating={review.rating} size={54 * u} color={palette.star} emptyColor={tint(palette, 0.25)} />
          </div>

          <div style={{ fontSize: 200 * u, lineHeight: 0.6, height: 100 * u, color: tint(palette, 0.35), fontWeight: 600 }}>“</div>

          <WordReveal
            text={review.text}
            startSeconds={1.2}
            wordsPerSecond={wordsPerSecond}
            gap={fontSize * 0.26}
            style={{ color: palette.text, fontSize, lineHeight: 1.28, fontWeight: 600, letterSpacing: -0.5 }}
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
            <Avatar name={review.author} size={92 * u} background={palette.badgeBg} color={palette.badgeText} />
            <div>
              <div style={{ color: palette.text, fontSize: 42 * u, fontWeight: 600 }}>{review.author}</div>
              {review.date && <div style={{ color: palette.textMuted, fontSize: 30 * u, marginTop: 4 * u }}>{review.date}</div>}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
