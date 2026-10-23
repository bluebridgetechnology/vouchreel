import Image from "next/image";
import { BrandMark, brands } from "@/components/marketing/brands";
import { Icon } from "@/components/ui/icon";

/**
 * "Fits the stack you already have": the Vouchreel mark at the centre, the tools it works with around it, and a
 * light pulse travelling out from the centre to each one. The tools and their logos are in brands.tsx.
 */
// The spokes are drawn in a 600 x 380 box with the hub at its centre, on an ellipse so the wide logos have room
const WIDTH = 600;
const HEIGHT = 380;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const RADIUS_X = 225;
const RADIUS_Y = 140;
// One beam per second, so each beam leaves the hub as its ring pulses
const STAGGER = 1;

const spokes = brands.map((brand, index) => {
  // Start at the top and go clockwise
  const angle = (index / brands.length) * Math.PI * 2 - Math.PI / 2;
  const x = CENTER_X + RADIUS_X * Math.cos(angle);
  const y = CENTER_Y + RADIUS_Y * Math.sin(angle);
  return { ...brand, x, y, path: `M${CENTER_X} ${CENTER_Y} L${x.toFixed(2)} ${y.toFixed(2)}` };
});

export function StackBeam() {
  return (
    <>
      {/* Phones: the hub does not fit beside seven logos, so they sit in a wrapped row */}
      <ul className="mx-auto mt-10 flex max-w-sm flex-wrap items-center justify-center gap-x-8 gap-y-6 sm:hidden">
        {brands.map((brand) => (
          <li key={brand.name} className="flex items-center gap-2">
            <BrandMark brand={brand} />
          </li>
        ))}
      </ul>

      <div className="relative mx-auto mt-12 hidden w-full max-w-3xl sm:block" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        {/* Orbit and spokes, with a pulse of light travelling out along each spoke (each path starts at the hub) */}
        <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none" className="absolute inset-0 size-full">
          <ellipse
            cx={CENTER_X}
            cy={CENTER_Y}
            rx={RADIUS_X}
            ry={RADIUS_Y}
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            className="stroke-border"
          />
          {spokes.map((spoke, index) => (
            <g key={spoke.name}>
              <path d={spoke.path} pathLength={100} strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="stroke-border" />
              <path
                d={spoke.path}
                pathLength={100}
                strokeWidth={2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="stack-beam-pulse stroke-brand"
                style={{ animationDelay: `${index * STAGGER}s` }}
              />
            </g>
          ))}
        </svg>

        {/* Hub */}
        <div className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill border bg-surface shadow-card">
          <span aria-hidden="true" className="stack-beam-hub-ring absolute inset-0 rounded-pill border border-brand" />
          <Image src="/brand/icon.png" alt="Vouchreel" width={404} height={306} className="h-9 w-auto" />
        </div>

        {/* The tools around it */}
        <ul className="absolute inset-0">
          {spokes.map((spoke) => (
            <li
              key={spoke.name}
              className="absolute flex w-max -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-pill border bg-surface px-4 py-2.5 shadow-card"
              style={{ left: `${(spoke.x / WIDTH) * 100}%`, top: `${(spoke.y / HEIGHT) * 100}%` }}
            >
              <BrandMark brand={spoke} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
