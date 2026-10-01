// Design-token guard. Fails when UI code bypasses the token system.
//   node scripts/check-tokens.mjs          -> report + exit 1 on violations
//   node scripts/check-tokens.mjs --list   -> also print every offending line
//
// Rules (see docs/ui-redesign-plan.md, section 4):
//   palette   raw Tailwind palette classes (bg-emerald-500, text-white, ...)
//   hex       hex / rgb() / hsl() colour literals in TSX
//   size      arbitrary text sizes (text-[11px])
//   weight    font-semibold / bold / extrabold / black (Outfit max weight is 500)
//   radius    legacy radius classes (rounded, rounded-md/lg/xl/2xl/full/sm/xs)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const LIST = process.argv.includes("--list");

const FAMS =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const UTIL = "bg|text|border|ring|fill|stroke|from|to|via|divide|outline|placeholder|decoration|accent";

const rules = {
  palette: new RegExp(`(?<![\\w-])(?:${UTIL})-(?:${FAMS})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`),
  hex: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/,
  size: /(?<![\w-])text-\[\d+(?:\.\d+)?(?:px|rem)\]/,
  weight: /(?<![\w-])font-(?:semibold|bold|extrabold|black)(?![\w-])/,
  radius: /(?<![\w-])rounded(?:-(?:sm|md|lg|xl|2xl|3xl|xs|full))?(?![\w-])/,
};

// Files where raw values are legitimate: brand logos, OG image, tests, generated files, token source.
const ALLOW = [
  /app[\\/]globals\.css$/,
  /app[\\/]\(marketing\)[\\/]opengraph-image\.tsx$/,
  /lib[\\/]brand\.ts$/,
  /\.test\.tsx?$/,
  /__tests__/,
  /icons\.generated\.ts$/,
];
// Lines that legitimately hold third-party brand colours (Google / Trustpilot logos).
const LINE_ALLOW = /fill="#(?:4285F4|34A853|FBBC05|EA4335|00b67a)"/i;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx|ts)$/.test(name)) yield p;
  }
}

const totals = Object.fromEntries(Object.keys(rules).map((k) => [k, 0]));
const byFile = new Map();
const lines = [];

for (const base of ["app", "components"]) {
  for (const file of walk(join(root, base))) {
    const rel = relative(root, file);
    if (ALLOW.some((r) => r.test(rel))) continue;
    // Server/route code (no JSX class names) is out of scope for class rules except hex.
    const isApi = rel.split(sep).includes("api");
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (LINE_ALLOW.test(line)) return;
        for (const [name, re] of Object.entries(rules)) {
          if (isApi && name !== "hex") continue;
          if (name !== "hex" && !/["'`]/.test(line)) continue;
          if (re.test(line)) {
            totals[name]++;
            byFile.set(rel, (byFile.get(rel) ?? 0) + 1);
            if (LIST) lines.push(`${rel}:${i + 1} [${name}] ${line.trim().slice(0, 140)}`);
          }
        }
      });
  }
}

if (LIST) console.log(lines.join("\n") + "\n");
console.log("Token violations:", totals);
const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
if (top.length) console.log("Worst files:\n" + top.map(([f, n]) => `  ${String(n).padStart(4)}  ${f}`).join("\n"));
const total = Object.values(totals).reduce((a, b) => a + b, 0);
process.exit(total ? 1 : 0);
