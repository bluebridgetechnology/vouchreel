import * as esbuild from "esbuild";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const widgetDir = import.meta.dirname;
const srcDir = path.join(widgetDir, "src");
const entryPoint = path.join(srcDir, "index.ts");
const outDir = path.join(widgetDir, "dist");
const outFile = path.join(outDir, "vouchreel-widget.js");
const compatFile = path.join(outDir, "widget.js");
const layoutsSrcDir = path.join(srcDir, "layouts");
const layoutsOutDir = path.join(outDir, "layouts");

/** Every layout chunk is a top-level .ts file in src/layouts (shared helpers like cards.ts are not). */
const LAYOUT_NAMES = fs
  .readdirSync(layoutsSrcDir)
  .filter((f) => f.endsWith(".ts") && f !== "cards.ts")
  .map((f) => f.slice(0, -3));

fs.rmSync(layoutsOutDir, { recursive: true, force: true });
fs.mkdirSync(layoutsOutDir, { recursive: true });

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

// A hash of the sources: the core asks for layout chunks with ?v=<hash>, so a deploy is never
// answered from a stale cache, and the chunks can be cached for a long time.
function sourceHash(dir) {
  const hash = crypto.createHash("sha256");
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "__tests__") continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else hash.update(entry.name).update(fs.readFileSync(full));
    }
  };
  walk(dir);
  return hash.digest("hex").slice(0, 10);
}
const build = sourceHash(srcDir);

const shared = {
  bundle: true,
  minify: true,
  format: "iife",
  plugins: [minifyCss],
  legalComments: "none",
  define: { __VR_BUILD__: JSON.stringify(build) },
};

await esbuild.build({ ...shared, entryPoints: [entryPoint], globalName: "Vouchreel", outfile: outFile });

await esbuild.build({
  ...shared,
  entryPoints: LAYOUT_NAMES.map((name) => path.join(layoutsSrcDir, `${name}.ts`)),
  outdir: layoutsOutDir,
});

// The dashboard editor's preview: core plus every layout in one file, driven by postMessage.
// Never served to customer sites, so it has no size budget.
await esbuild.build({
  ...shared,
  stdin: {
    contents: [...LAYOUT_NAMES.map((name) => `import "./layouts/${name}";`), `import "./preview";`].join(";"),
    resolveDir: srcDir,
    loader: "ts",
  },
  outfile: path.join(outDir, "preview.js"),
});
fs.copyFileSync(path.join(srcDir, "preview.html"), path.join(outDir, "preview.html"));

// Also create dist/widget.js copy for compatibility
fs.copyFileSync(outFile, compatFile);

// Sync with dashboard public directory (served as /widget/vouchreel-widget.js and /widget/layouts/<name>.js)
const dashboardPublicDir = path.resolve(widgetDir, "../../apps/dashboard/public/widget");
try {
  fs.mkdirSync(dashboardPublicDir, { recursive: true });
  fs.copyFileSync(outFile, path.join(dashboardPublicDir, "vouchreel-widget.js"));
  fs.copyFileSync(path.join(outDir, "preview.js"), path.join(dashboardPublicDir, "preview.js"));
  fs.copyFileSync(path.join(outDir, "preview.html"), path.join(dashboardPublicDir, "preview.html"));
  const publicLayouts = path.join(dashboardPublicDir, "layouts");
  fs.rmSync(publicLayouts, { recursive: true, force: true });
  fs.cpSync(layoutsOutDir, publicLayouts, { recursive: true });
} catch {
  // ignore
}

console.log(`✓ Widget build completed successfully (build ${build}, layouts: ${LAYOUT_NAMES.join(", ")}).`);
