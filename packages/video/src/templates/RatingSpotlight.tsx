import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Avatar, Orb, Stars, WordReveal, clamped, fitFontSize, useFadeIn, useLayout, useOutro, useSpringIn } from "../components/primitives";
import { SourceMark } from "../components/SourceMark";
import { RATING_INTRO_SECONDS } from "../registry";
import { FONT_SANS, brandForWhiteText, darken } from "../lib/theme";
import type { ReviewVideoProps } from "../types";

const INK = "#1c1917";
const MUTED = "#78716c";

/** Scene 1: the provider-reported overall rating and review count, counting up. */
const RatingScene: React.FC<{ aggregate: NonNullable<ReviewVideoProps["aggregate"]> }> = ({ aggregate }) => {
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
        <div style={{ color: "#ffffff", fontSize: 330 * u, lineHeight: 1, fontWeight: 600, letterSpacing: -8 * u }}>{rating.toFixed(1)}</div>
        <div style={{ display: "flex", justifyContent: "center", margin: `${34 * u}px 0 ${40 * u}px` }}>
          <Stars rating={aggregate.rating} size={92 * u} startSeconds={0.4} />
        </div>
        <div style={{ color: "#ffffff", fontSize: 58 * u, fontWeight: 500 }}>
          from {total.toLocaleString("en-US")} reviews
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 26 * u }}>
          <SourceMark source={aggregate.source} u={u} onDark size={1.25} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Scene 2: one standout review on a white card. */
const ReviewScene: React.FC<{ review: ReviewVideoProps["reviews"][number]; base: string }> = ({ review, base }) => {
  const { u, portrait } = useLayout();
  const { durationInFrames } = useVideoConfig();
  const slide = useSpringIn(0, { damping: 17, stiffness: 90 });
  const wordsPerSecond = 4.6;
  const revealEnd = 0.8 + review.text.split(/\s+/).length / wordsPerSecond;
  const authorIn = useFadeIn(revealEnd - 0.3, 0.6);
  const outro = useOutro(durationInFrames);
  const fontSize = fitFontSize(review.text, portrait) * 0.82 * u;

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
          <Stars rating={review.rating} size={50 * u} emptyColor="rgba(0,0,0,0.12)" startSeconds={0.3} />
          <SourceMark source={review.source} u={u * 0.9} onDark={false} />
        </div>
        <div style={{ fontSize: 170 * u, lineHeight: 0.55, height: 84 * u, color: `${base}55`, fontWeight: 600 }}>“</div>
        <WordReveal
          text={review.text}
          startSeconds={0.8}
          wordsPerSecond={wordsPerSecond}
          gap={fontSize * 0.25}
          style={{ color: INK, fontSize, lineHeight: 1.32, fontWeight: 500, letterSpacing: -0.3 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 24 * u, marginTop: 46 * u, opacity: authorIn, transform: `translateY(${(1 - authorIn) * 24 * u}px)` }}>
          <Avatar name={review.author} size={82 * u} background={base} color="#ffffff" />
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
export const RatingSpotlight: React.FC<ReviewVideoProps> = ({ reviews, brand, aggregate }) => {
  const { u, fps } = useLayout();
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const base = brandForWhiteText(brand);
  const angle = 150 + interpolate(frame, [0, durationInFrames], [0, 30]);
  const introFrames = Math.round(RATING_INTRO_SECONDS * fps);
  const overlap = Math.round(0.4 * fps);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${base} 0%, ${darken(base, 0.58)} 100%)`, fontFamily: FONT_SANS }}>
      <Orb size={1000 * u} color="rgba(255,255,255,0.07)" top={-380 * u} left={-300 * u} />
      <Orb size={760 * u} color="rgba(0,0,0,0.15)" bottom={-260 * u} right={-220 * u} phase={2} />
      {aggregate && (
        <Sequence from={0} durationInFrames={introFrames}>
          <RatingScene aggregate={aggregate} />
        </Sequence>
      )}
      <Sequence from={introFrames - overlap} durationInFrames={Math.max(1, durationInFrames - (introFrames - overlap))}>
        <ReviewScene review={reviews[0]} base={base} />
      </Sequence>
    </AbsoluteFill>
  );
};
