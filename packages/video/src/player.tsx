"use client";

import React, { useEffect } from "react";
import { Player } from "@remotion/player";
import { TEMPLATE_COMPONENTS } from "./templates";
import { ensureVideoFontFaces } from "./lib/font-faces";
import { FPS, dimensionsFor, durationInFrames, validateProps, type Aspect, type ReviewVideoProps } from "./registry";

export { SAMPLE_PROPS } from "./sample";

/**
 * Browser preview of a template: the real composition rendered live by Remotion's player, so what the
 * customer sees while choosing colours and styles is exactly what the render produces.
 * Imported by the dashboard only; the server-side renderer never touches this file.
 */

export interface ReviewVideoPreviewProps {
  templateId: string;
  aspect: Aspect;
  props: ReviewVideoProps;
  /** Where the font files are served from, e.g. "/video-fonts". */
  fontBaseUrl: string;
  className?: string;
}

export function ReviewVideoPreview({ templateId, aspect, props, fontBaseUrl, className }: ReviewVideoPreviewProps) {
  useEffect(() => ensureVideoFontFaces(fontBaseUrl), [fontBaseUrl]);

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
