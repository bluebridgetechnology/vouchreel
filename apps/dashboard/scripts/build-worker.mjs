// Bundles the worker entry points (with the "@/" alias resolved) for production:
//   lib/jobs/main.ts        -> dist/worker.mjs        (ffmpeg jobs; the image has ffmpeg)
//   lib/jobs/main-video.ts  -> dist/video-worker.mjs  (Remotion renders; the image has Chromium)
// The video bundle inlines the workspace package @vouchreel/video (TypeScript source) but leaves
// npm packages such as @remotion/renderer external.
import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const videoSrc = path.resolve(root, "../../packages/video/src");

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: [path.join(root, "lib/jobs/main.ts")],
  outfile: path.join(root, "dist/worker.mjs"),
  alias: { "@": root },
});

await build({
  ...common,
  entryPoints: [path.join(root, "lib/jobs/main-video.ts")],
  outfile: path.join(root, "dist/video-worker.mjs"),
  alias: {
    "@": root,
    "@vouchreel/video/render": path.join(videoSrc, "render.ts"),
    "@vouchreel/video": path.join(videoSrc, "registry.ts"),
  },
});
