import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SourceMark } from "../components/SourceMark";
import { Avatar, Stars, WordReveal, clamped, fitFontSize, useFadeIn, useLayout, useOutro, useSpringIn } from "../components/primitives";
import { RATING_INTRO_SECONDS } from "../registry";
import { bodyFont, rgba } from "../lib/theme";
import { tint, type Palette } from "../lib/palette";
import { usePalette } from "../lib/usePalette";
import type { ReviewVideoProps } from "../types";

/** The review card is always white, so its text colours are fixed; the background around it follows the style. */
const INK = "#1c1917";
const MUTED = "#78716c";

/** Scene 1: the provider-reported overall rating and review count, counting up. */
const RatingScene: React.FC<{ aggregate: NonNullable<ReviewVideoProps["aggregate"]>; palette: Palette }> = ({ aggregate, palette }) => {
  const { u, fps } = useLayout();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0.3 * fps, 1.7 * fps], [0, 1], { ...clamped });
  const eased = 1 - Math.pow(1 - progress, 3);
  const rating = aggregate.rating * eased;
  const total = Math.round(aggregate.total * eased);
  const pop = useSpringIn(0.1, { damping: 14, stiffness: 110 });
  const exit = interpolate(frame, [durationInFrames - 0.5 * fps, durationInFrames], [1, 0], { ...clamped });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: exit, transform: `translateY(${(1 - exit) * -60 * u}px)` }}>
      <div style={{ textAlign: "center", transform: `scale(${0.85 + 0.15 * pop})`, opacity: pop }}>
        <div style={{ color: palette.text, fontSize: 330 * u, lineHeight: 1, fontWeight: 600, letterSpacing: -8 * u }}>{rating.toFixed(1)}</div>
        <div style={{ display: "flex", justifyContent: "center", margin: `${34 * u}px 0 ${40 * u}px` }}>
          <Stars rating={aggregate.rating} size={92 * u} color={palette.star} emptyColor={tint(palette, 0.25)} startSeconds={0.4} />
        </div>
        <div style={{ color: palette.text, fontSize: 58 * u, fontWeight: 500 }}>from {total.toLocaleString("en-US")} reviews</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 26 * u }}>
          <SourceMark source={aggregate.source} u={u} onDark={palette.style !== "light"} textColor={palette.text} size={1.25} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Scene 2: one standout review on a white card. */
const ReviewScene: React.FC<{ review: ReviewVideoProps["reviews"][number]; palette: Palette; font?: string }> = ({ review, palette, font }) => {
  const { u, portrait } = useLayout();
  const { durationInFrames } = useVideoConfig();
  const slide = useSpringIn(0, { damping: 17, stiffness: 90 });
  const wordsPerSecond = 4.6;
  const revealEnd = 0.8 + review.text.split(/\s+/).length / wordsPerSecond;
  const authorIn = useFadeIn(revealEnd - 0.3, 0.6);
  const outro = useOutro(durationInFrames);
  const fontSize = fitFontSize(review.text, portrait, font) * 0.82 * u;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: (portrait ? 80 : 170) * u, opacity: outro }}>
      <div
        style={{
          width: "100%",
          maxWidth: (portrait ? 920 : 1380) * u,
          background: "#ffffff",
          borderRadius: 48 * u,
          padding: (portrait ? 74 : 72) * u,
          boxShadow: `0 ${34 * u}px ${90 * u}px rgba(0,0,0,0.38)`,
          opacity: slide,
          transform: `translateX(${(1 - slide) * 260 * u}px)`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 * u }}>
          {review.rating != null && <Stars rating={review.rating} size={50 * u} emptyColor="rgba(0,0,0,0.12)" startSeconds={0.3} />}
          <SourceMark source={review.source} domain={review.link} u={u * 0.9} onDark={false} />
        </div>
        <div style={{ fontSize: 170 * u, lineHeight: 0.55, height: 84 * u, color: rgba(palette.accent, 0.33), fontWeight: 600 }}>“</div>
        <WordReveal
          text={review.text}
          startSeconds={0.8}
          wordsPerSecond={wordsPerSecond}
          gap={fontSize * 0.25}
          style={{ color: INK, fontSize, lineHeight: 1.32, fontWeight: 500, letterSpacing: -0.3 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 24 * u, marginTop: 46 * u, opacity: authorIn, transform: `translateY(${(1 - authorIn) * 24 * u}px)` }}>
          <Avatar name={review.author} size={82 * u} background={palette.accent} color="#ffffff" />
          <div>
            <div style={{ color: INK, fontSize: 40 * u, fontWeight: 600 }}>{review.author}</div>
            {review.date && <div style={{ color: MUTED, fontSize: 28 * u, marginTop: 4 * u }}>{review.date}</div>}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Opens on the overall rating, then shows one standout review. Needs the source's totals. */
export const RatingSpotlight: React.FC<ReviewVideoProps> = (props) => {
  const { reviews, aggregate } = props;
  const palette = usePalette(props, "gradient");
  const { fps } = useLayout();
  const { durationInFrames } = useVideoConfig();

  const introFrames = Math.round(RATING_INTRO_SECONDS * fps);
  const overlap = Math.round(0.4 * fps);

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont(props.theme?.font) }}>
      <Backdrop palette={palette} secondary={props.theme?.secondary} />
      {aggregate && (
        <Sequence from={0} durationInFrames={introFrames}>
          <RatingScene aggregate={aggregate} palette={palette} />
        </Sequence>
      )}
      <Sequence from={introFrames - overlap} durationInFrames={Math.max(1, durationInFrames - (introFrames - overlap))}>
        <ReviewScene review={reviews[0]} palette={palette} font={props.theme?.font} />
      </Sequence>
    </AbsoluteFill>
  );
};
