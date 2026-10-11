import fs from "fs";
import zlib from "zlib";
import path from "path";

const widgetDir = import.meta.dirname;
const coreFile = path.join(widgetDir, "dist/vouchreel-widget.js");
const layoutsDir = path.join(widgetDir, "dist/layouts");

// Visible well before the build fails, so a feature is not the one that finds out
const WARN_AT = 0.95;

/**
 * Two budgets: the core every page loads (loader, triggers, analytics, player, dialogs and the
 * default floating card), and each layout chunk, which a page loads only when it shows that layout.
 */
const budgets = [{ label: "core", file: coreFile, max: 15 * 1024 }];
if (fs.existsSync(layoutsDir)) {
  for (const f of fs.readdirSync(layoutsDir).filter((f) => f.endsWith(".js")).sort()) {
    budgets.push({ label: `layout ${f.slice(0, -3)}`, file: path.join(layoutsDir, f), max: 5 * 1024 });
  }
}

let failed = false;
for (const { label, file, max } of budgets) {
  if (!fs.existsSync(file)) {
    console.error(`Error: Build file not found at ${file}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(file);
  const gzip = zlib.gzipSync(raw).length;
  const used = gzip / max;
  const remaining = max - gzip;
  const budgetKb = (max / 1024).toFixed(0);
  const line = `${label.padEnd(22)} raw ${(raw.length / 1024).toFixed(2)} KB, gzip ${(gzip / 1024).toFixed(2)} KB of ${budgetKb} KB (${(used * 100).toFixed(1)}%, ${remaining} bytes left)`;

  if (gzip > max) {
    console.error(`❌ ${line}`);
    failed = true;
  } else {
    console.log(`✓ ${line}`);
    if (used >= WARN_AT) {
      // "::warning::" shows as an annotation in GitHub Actions
      console.log(`::warning::Widget ${label} is at ${(used * 100).toFixed(1)}% of its ${budgetKb} KB budget (${remaining} bytes left). Anything added to it must be paid for by removing something else.`);
    }
  }
}

if (failed) {
  console.error(`\n❌ BUILD FAILED: a widget bundle exceeds its gzip budget.`);
  process.exit(1);
}
