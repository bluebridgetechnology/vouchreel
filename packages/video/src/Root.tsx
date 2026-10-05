import React from "react";
import { Composition } from "remotion";
import { TEMPLATE_COMPONENTS as COMPONENTS } from "./templates";
import { compositionId, dimensionsFor, durationInFrames, FPS, TEMPLATES, type Aspect, type ReviewVideoProps } from "./registry";
import { fontsReady } from "./lib/fonts";
import { SAMPLE_PROPS } from "./sample";

const ASPECT_LIST: Aspect[] = ["9:16", "16:9"];

export const Root: React.FC = () => (
  <>
    {TEMPLATES.filter((t) => COMPONENTS[t.id]).flatMap((template) =>
      ASPECT_LIST.map((aspect) => {
        const { width, height } = dimensionsFor(aspect);
        return (
          <Composition
            key={`${template.id}-${aspect}`}
            id={compositionId(template.id, aspect)}
            component={COMPONENTS[template.id] as unknown as React.FC<Record<string, unknown>>}
            width={width}
            height={height}
            fps={FPS}
            durationInFrames={durationInFrames(template.id, SAMPLE_PROPS[template.id])}
            defaultProps={SAMPLE_PROPS[template.id]}
            // The real length depends on the review text, so it is computed per render
            calculateMetadata={async ({ props }) => {
              await fontsReady;
              return { durationInFrames: durationInFrames(template.id, props as unknown as ReviewVideoProps) };
            }}
          />
        );
      }),
    )}
  </>
);
