"use client";

import React, { useEffect } from "react";
import { Player } from "@remotion/player";
import { TEMPLATE_COMPONENTS } from "./templates";
import { FPS, dimensionsFor, durationInFrames, validateProps, type Aspect, type ReviewVideoProps } from "./registry";

export { SAMPLE_PROPS } from "./sample";

/**
 * Browser preview of a template: the real composition rendered live by Remotion's player, so what the
 * customer sees while choosing colours and styles is exactly what the render produces.
 * Imported by the dashboard only; the server-side renderer never touches this file.
 */

const FONT_STYLE_ID = "vouchreel-video-fonts";

/** The two fonts the templates use, served from `fontBaseUrl` (the render bundles its own copies). */
function ensureFonts(fontBaseUrl: string) {
  if (typeof document === "undefined" || document.getElementById(FONT_STYLE_ID)) return;
  const base = fontBaseUrl.replace(/\/$/, "");
  const style = document.createElement("style");
  style.id = FONT_STYLE_ID;
  style.textContent = [
    `@font-face{font-family:"Outfit";font-weight:400;font-display:block;src:url(${base}/outfit-latin-400-normal.woff2) format("woff2")}`,
    `@font-face{font-family:"Outfit";font-weight:500;font-display:block;src:url(${base}/outfit-latin-500-normal.woff2) format("woff2")}`,
    `@font-face{font-family:"Outfit";font-weight:600;font-display:block;src:url(${base}/outfit-latin-600-normal.woff2) format("woff2")}`,
    `@font-face{font-family:"Playfair Display";font-style:italic;font-weight:500;font-display:block;src:url(${base}/playfair-display-latin-500-italic.woff2) format("woff2")}`,
  ].join("\n");
  document.head.appendChild(style);
}

export interface ReviewVideoPreviewProps {
  templateId: string;
  aspect: Aspect;
  props: ReviewVideoProps;
  /** Where the font files are served from, e.g. "/video-fonts". */
  fontBaseUrl: string;
  className?: string;
}

export function ReviewVideoPreview({ templateId, aspect, props, fontBaseUrl, className }: ReviewVideoPreviewProps) {
  useEffect(() => ensureFonts(fontBaseUrl), [fontBaseUrl]);

  const Component = TEMPLATE_COMPONENTS[templateId];
  const problems = validateProps(templateId, props);
  if (!Component || problems.length > 0) {
    return <div className={className}>{problems[0] ?? "Preview unavailable."}</div>;
  }

  const { width, height } = dimensionsFor(aspect);
  const frames = durationInFrames(templateId, props);
  return (
    <Player
      className={className}
      component={Component as React.ComponentType<never>}
      inputProps={props as never}
      durationInFrames={frames}
      fps={FPS}
      compositionWidth={width}
      compositionHeight={height}
      // Every template animates in from nothing, so open on a frame where the content is visible
      initialFrame={Math.floor(frames * 0.62)}
      controls
      loop
      clickToPlay
      doubleClickToFullscreen
      style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}
    />
  );
}
