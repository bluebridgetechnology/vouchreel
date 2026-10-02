// Bundles lib/jobs/main.ts (with the "@/" alias resolved) into dist/worker.mjs for production.
import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [path.join(root, "lib/jobs/main.ts")],
  outfile: path.join(root, "dist/worker.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  alias: { "@": root },
  logLevel: "info",
});
