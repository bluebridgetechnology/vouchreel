import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SourceMark } from "../components/SourceMark";
import { Stars, WordReveal, clamped, fitFontSize, useFadeIn, useLayout, useOutro } from "../components/primitives";
import { bodyFont, quoteFont } from "../lib/theme";
import { tint } from "../lib/palette";
import { usePalette } from "../lib/usePalette";
import type { ReviewVideoProps } from "../types";

/** Clean layout with an elegant serif quote. Light by default; works on any background style. */
export const Minimal: React.FC<ReviewVideoProps> = (props) => {
  const review = props.reviews[0];
  const palette = usePalette(props, "light");
  const { u, portrait } = useLayout();
  const { durationInFrames, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const onLight = palette.style === "light";
  // On paper the stars and the rule use the brand colour (adjusted to be visible); elsewhere the text colour
  const ruleColor = onLight ? palette.accent : palette.text;
  const starColor = onLight ? palette.accent : palette.star;

  const wordsPerSecond = 4.2;
  const revealStart = 0.9;
  const revealEnd = revealStart + review.text.split(/\s+/).length / wordsPerSecond;
  const ruleWidth = interpolate(frame, [0.1 * fps, 0.9 * fps], [0, 1], { ...clamped });
  const authorIn = useFadeIn(revealEnd - 0.3, 0.7);
  const head = useFadeIn(0.1, 0.7);
  const outro = useOutro(durationInFrames);
  const fontSize = fitFontSize(review.text, portrait, props.theme?.font) * 0.92 * u;

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont(props.theme?.font), opacity: outro }}>
      <Backdrop palette={palette} secondary={props.theme?.secondary} />

      <AbsoluteFill style={{ justifyContent: "center", padding: (portrait ? 110 : 190) * u }}>
        <div style={{ maxWidth: (portrait ? 860 : 1380) * u }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 * u, opacity: head }}>
            {review.rating != null && <Stars rating={review.rating} size={44 * u} color={starColor} emptyColor={tint(palette, 0.16)} startSeconds={0.2} />}
            <SourceMark source={review.source} domain={review.link} u={u} onDark={!onLight} textColor={palette.textMuted} />
          </div>

          <div style={{ height: 3 * u, width: 150 * u * ruleWidth, background: ruleColor, margin: `${38 * u}px 0 ${44 * u}px` }} />

          <WordReveal
            text={review.text}
            startSeconds={revealStart}
            wordsPerSecond={wordsPerSecond}
            gap={fontSize * 0.24}
            style={{ color: palette.text, fontSize, lineHeight: 1.32, ...quoteFont(props.theme?.font), fontWeight: 500, letterSpacing: -0.3 }}
          />

          <div style={{ marginTop: 58 * u, opacity: authorIn, transform: `translateY(${(1 - authorIn) * 24 * u}px)` }}>
            <div style={{ color: palette.text, fontSize: 42 * u, fontWeight: 500 }}>{review.author}</div>
            {review.date && <div style={{ color: palette.textMuted, fontSize: 30 * u, marginTop: 6 * u }}>{review.date}</div>}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
