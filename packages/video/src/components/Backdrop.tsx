import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../lib/palette";
import { auroraBlobs, tint } from "../lib/palette";
import { lighten, mix, rgba } from "../lib/theme";
import { Orb, useLayout } from "./primitives";

/**
 * The background for every template. A style decides the look; every colour comes from the palette
 * (derived from the customer's brand colour), so any colour works with any style, and the palette
 * has already guaranteed that the text drawn on top is readable.
 */
export const Backdrop: React.FC<{ palette: Palette; secondary?: string }> = ({ palette, secondary }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u, width, height } = useLayout();
  const angle = 135 + interpolate(frame, [0, durationInFrames], [0, 40]);
  const gradient = `linear-gradient(${angle}deg, ${palette.bgFrom} 0%, ${palette.bgTo} 100%)`;

  switch (palette.style) {
    case "solid":
      return (
        <AbsoluteFill style={{ background: palette.bgFrom }}>
          <Orb size={1200 * u} color={palette.decorB} top={-420 * u} right={-380 * u} drift={0.03} />
          <Orb size={900 * u} color={palette.decorA} bottom={-360 * u} left={-300 * u} phase={2} drift={0.03} />
        </AbsoluteFill>
      );

    case "aurora": {
      // Three soft blobs of hue-shifted brand colour drifting over the base. The shifts keep each
      // blob's brightness, so the text contrast the palette guaranteed still holds.
      const base = mix(palette.bgFrom, palette.bgTo, 0.5);
      const blobs = auroraBlobs(palette, Boolean(secondary));
      return (
        <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
          {blobs.map((b, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: b.size * u,
                height: b.size * u,
                left: `calc(${b.x}% - ${(b.size * u) / 2}px + ${Math.sin(frame / 75 + b.phase) * 90 * u}px)`,
                top: `calc(${b.y}% - ${(b.size * u) / 2}px + ${Math.cos(frame / 90 + b.phase) * 90 * u}px)`,
                borderRadius: "50%",
                background: `radial-gradient(circle at 50% 50%, ${rgba(b.color, 0.92)} 0%, ${rgba(b.color, 0)} 68%)`,
                opacity: 0.75,
              }}
            />
          ))}
        </AbsoluteFill>
      );
    }

    case "dots": {
      const spacing = 58 * u;
      const drift = (frame / durationInFrames) * spacing * 2;
      return (
        <AbsoluteFill style={{ background: gradient }}>
          <AbsoluteFill
            style={{
              backgroundImage: `radial-gradient(circle, ${tint(palette, 0.22)} ${3.4 * u}px, transparent ${4 * u}px)`,
              backgroundSize: `${spacing}px ${spacing}px`,
              backgroundPosition: `${drift}px ${drift}px`,
              // fade the pattern out toward the middle so it never fights the text
              WebkitMaskImage: `radial-gradient(ellipse ${width * 0.75}px ${height * 0.6}px at 50% 50%, transparent 0%, #000 100%)`,
              maskImage: `radial-gradient(ellipse ${width * 0.75}px ${height * 0.6}px at 50% 50%, transparent 0%, #000 100%)`,
            }}
          />
        </AbsoluteFill>
      );
    }

    case "light":
      return (
        <AbsoluteFill style={{ background: gradient }}>
          <Orb size={1100 * u} color={palette.decorA} top={-420 * u} right={-380 * u} drift={0.03} />
          <Orb size={520 * u} color={palette.decorB} bottom={-160 * u} left={-140 * u} phase={1.5} drift={0.03} />
        </AbsoluteFill>
      );

    case "dark": {
      // Near-black with a slowly drifting glow of the brand colour
      const glow = lighten(palette.accentOnDark, 0.08);
      const gx = 50 + Math.sin(frame / 90) * 12;
      const gy = 35 + Math.cos(frame / 110) * 10;
      return (
        <AbsoluteFill style={{ background: gradient }}>
          <AbsoluteFill
            style={{
              background: `radial-gradient(${Math.max(width, height) * 0.62}px at ${gx}% ${gy}%, ${rgba(glow, 0.5)} 0%, ${rgba(palette.brand, 0.16)} 45%, transparent 75%)`,
            }}
          />
        </AbsoluteFill>
      );
    }

    case "gradient":
    default:
      return (
        <AbsoluteFill style={{ background: gradient }}>
          <Orb size={900 * u} color={palette.decorA} top={-280 * u} right={-260 * u} />
          <Orb size={700 * u} color={palette.decorB} bottom={-240 * u} left={-220 * u} phase={2} />
        </AbsoluteFill>
      );
  }
};
