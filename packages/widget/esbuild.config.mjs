import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

const widgetDir = import.meta.dirname;
const entryPoint = path.join(widgetDir, "src/index.ts");
const outDir = path.join(widgetDir, "dist");
const outFile = path.join(outDir, "vouchreel-widget.js");
const compatFile = path.join(outDir, "widget.js");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

await esbuild.build({
  entryPoints: [entryPoint],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "Vouchreel",
  loader: {
    ".css": "text",
  },
  outfile: outFile,
  legalComments: "none",
});

// Also create dist/widget.js copy for compatibility
fs.copyFileSync(outFile, compatFile);

// Sync with dashboard public directory
const dashboardPublicDir = path.resolve(widgetDir, "../../apps/dashboard/public/widget");
try {
  if (!fs.existsSync(dashboardPublicDir)) {
    fs.mkdirSync(dashboardPublicDir, { recursive: true });
  }
  fs.copyFileSync(outFile, path.join(dashboardPublicDir, "vouchreel-widget.js"));
} catch {
  // ignore
}

console.log("✓ Widget build completed successfully.");
