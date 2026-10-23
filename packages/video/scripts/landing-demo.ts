/**
 * Renders the sample videos for the marketing site's live widget demo.
 *   npm run landing-demo -w @vouchreel/video
 *
 * Every person and business here is made up, and the demo labels them as sample content. The reviews are
 * "own" reviews (no Google or Trustpilot badge), so nothing looks like a real third-party review.
 * Output: apps/dashboard/public/demo/sample-N.mp4 (540x960, small) and sample-N.jpg (poster).
 * Needs FFmpeg on PATH for the compression step.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { renderReviewVideo } from "../src/render";
import type { BackgroundStyle, ReviewVideoProps } from "../src/types";

/** Keep in step with LANDING_DEMO_CONTENT in apps/dashboard/lib/landing-demo.ts (same order, same words). */
const SAMPLES: { author: string; text: string; brand: string; template: string; style: BackgroundStyle }[] = [
  {
    author: "Sarah Chen",
    text: "The beans arrive fresh every month and the tasting notes are spot on. It's the first coffee club I haven't cancelled.",
    brand: "#b45309",
    template: "spotlight",
    style: "aurora",
  },
  {
    author: "David Okafor",
    text: "I was nervous about joining a gym again. The coaches made the first week easy and I've kept going ever since.",
    brand: "#1d4ed8",
    template: "dark-card",
    style: "dark",
  },
  {
    author: "Maria Lopez",
    text: "They rebuilt our website in three weeks and explained every decision along the way.",
    brand: "#0f766e",
    template: "minimal",
    style: "light",
  },
  {
    author: "Aiko Tanaka",
    text: "Gentle, simple and it smells lovely. My skin felt calmer within a few days.",
    brand: "#be185d",
    template: "spotlight",
    style: "gradient",
  },
  {
    author: "Liam Walsh",
    text: "Booking a viewing took two minutes, and the agent knew every detail of the flat.",
    brand: "#4338ca",
    template: "dark-card",
    style: "dots",
  },
  {
    author: "Nia Adeyemi",
    text: "Practical from day one. I finished my first client project before the course ended.",
    brand: "#cf3d0b",
    template: "minimal",
    style: "light",
  },
];

const root = path.resolve(import.meta.dirname, "../../..");
const work = path.resolve(import.meta.dirname, "../out/landing-demo");
const dest = path.join(root, "apps/dashboard/public/demo");
mkdirSync(work, { recursive: true });
mkdirSync(dest, { recursive: true });

function ffmpeg(args: string[]) {
  const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

for (const [i, sample] of SAMPLES.entries()) {
  const n = i + 1;
  const props: ReviewVideoProps = {
    reviews: [{ author: sample.author, rating: null, text: sample.text, source: "own" }],
    brand: sample.brand,
    theme: { style: sample.style },
  };
  const raw = path.join(work, `sample-${n}.mp4`);
  await renderReviewVideo({ templateId: sample.template, aspect: "9:16", props, outputPath: raw });

  // Half the render size and a higher CRF: the widget shows these small, and the landing page should stay light
  ffmpeg(["-i", raw, "-vf", "scale=540:960", "-c:v", "libx264", "-crf", "30", "-preset", "slow", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", path.join(dest, `sample-${n}.mp4`)]);
  // Poster from late in the clip, when the whole quote is on screen
  ffmpeg(["-sseof", "-1.5", "-i", raw, "-frames:v", "1", "-vf", "scale=540:960", "-q:v", "4", path.join(dest, `sample-${n}.jpg`)]);
  console.log(`sample-${n}: ${sample.author} (${sample.template}, ${sample.style})`);
}

rmSync(work, { recursive: true, force: true });
process.exit(0);
