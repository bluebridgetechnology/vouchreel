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

// Widget CSS is inlined as a string. Minify it (strips comments and whitespace) so the
// documented design-token block costs nothing in the shipped bundle.
const minifyCss = {
  name: "minify-css-text",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const source = await fs.promises.readFile(args.path, "utf8");
      const { code } = await esbuild.transform(source, { loader: "css", minify: true });
      return { contents: code, loader: "text" };
    });
  },
};

await esbuild.build({
  entryPoints: [entryPoint],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "Vouchreel",
  plugins: [minifyCss],
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
