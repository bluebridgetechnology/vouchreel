/**
 * Pre-builds the Remotion bundle so the render worker does not run webpack at start-up.
 *   npm run bundle -w @vouchreel/video -- <outDir>
 * Point VIDEO_BUNDLE_DIR at the output when running the video worker.
 */
import path from "node:path";
import { bundle } from "@remotion/bundler";

const out = path.resolve(process.argv[2] ?? "out/bundle");
const result = await bundle({ entryPoint: path.resolve(import.meta.dirname, "../src/entry.tsx"), outDir: out });
console.log(`Remotion bundle written to ${result}`);
