// WCAG contrast guard for the design tokens in app/globals.css.
//   node scripts/check-contrast.mjs          -> table + exit 1 if any pair fails
//   node scripts/check-contrast.mjs --all    -> also print passing pairs
//
// Resolves the semantic tokens for light (:root) and dark (.dark), converts OKLCH to sRGB,
// composites translucent colours over the surface they sit on, and checks every
// foreground/background pair the UI actually uses.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
const SHOW_ALL = process.argv.includes("--all");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing ${selector} block`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", start) + 1, i);
  }
  throw new Error(`Unclosed ${selector}`);
}

function vars(body) {
  const out = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = vars(block("  :root"));
const dark = { ...light, ...vars(block("  .dark")) };

function resolve(theme, value, depth = 0) {
  if (depth > 10) throw new Error("var() cycle");
  const m = /^var\(--([\w-]+)\)$/.exec(value);
  return m ? resolve(theme, theme[m[1]], depth + 1) : value;
}

function oklchToRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((x) => Math.min(1, Math.max(0, x)));
  return lin; // linear sRGB
}

function parse(theme, name) {
  const v = resolve(theme, theme[name]);
  const m = /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(v);
  if (!m) throw new Error(`Cannot parse --${name}: ${v}`);
  return { rgb: oklchToRgb(+m[1], +m[2], +m[3]), alpha: m[4] === undefined ? 1 : +m[4] };
}

function over(fg, bg) {
  return fg.rgb.map((c, i) => c * fg.alpha + bg[i] * (1 - fg.alpha));
}

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum ratio, note]
const TEXT = 4.5;
const UI = 3;
const pairs = [
  ["text", "canvas", TEXT],
  ["text", "surface", TEXT],
  ["text", "surface-raised", TEXT],
  ["text", "surface-sunken", TEXT],
  ["text-muted", "canvas", TEXT],
  ["text-muted", "surface", TEXT],
  ["text-muted", "surface-sunken", TEXT],
  ["text-subtle", "surface", TEXT],
  ["text-subtle", "canvas", TEXT],
  ["text-inverse", "surface-inverse", TEXT],
  ["text-on-accent", "brand", TEXT],
  ["text-on-accent", "brand-hover", TEXT],
  ["text-on-accent", "success", TEXT],
  ["text-on-accent", "danger", TEXT],
  ["on-warning", "warning", TEXT],
  ["brand", "surface", TEXT, "text-brand links on cards"],
  ["brand", "canvas", TEXT, "text-brand links on page"],
  ["brand-soft-foreground", "brand-soft", TEXT],
  ["success-foreground", "success-soft", TEXT],
  ["warning-foreground", "warning-soft", TEXT],
  ["info-foreground", "info-soft", TEXT],
  ["danger-foreground", "danger-soft", TEXT],
  ["success-foreground", "surface", TEXT],
  ["danger-foreground", "surface", TEXT],
  ["tint-foreground", "tint-pink", TEXT],
  ["tint-foreground", "tint-lime", TEXT],
  ["tint-foreground", "tint-peach", TEXT],
  ["tint-foreground", "tint-cream", TEXT],
  // Non-text UI: field outlines and focus indicators need 3:1 against their surroundings
  ["field-border", "surface", UI, "input outline"],
  ["ring", "surface", UI, "focus ring"],
  ["ring", "canvas", UI, "focus ring"],
];

let failures = 0;
const rows = [];
for (const [themeName, theme] of [["light", light], ["dark", dark]]) {
  const canvas = parse(theme, "canvas").rgb;
  for (const [fgName, bgName, min, note] of pairs) {
    const bg = over(parse(theme, bgName), canvas);
    const fg = over(parse(theme, fgName), bg);
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failures++;
    if (!ok || SHOW_ALL) rows.push(`${ok ? "pass" : "FAIL"}  ${themeName.padEnd(5)}  ${fgName} on ${bgName}  ${r.toFixed(2)} (min ${min})${note ? "  " + note : ""}`);
  }
}

console.log(rows.join("\n") || "All token pairs meet WCAG AA.");
console.log(`\nContrast: ${pairs.length * 2 - failures}/${pairs.length * 2} pairs pass`);
process.exit(failures ? 1 : 0);
