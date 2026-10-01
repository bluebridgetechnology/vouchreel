import fs from "fs";
import zlib from "zlib";
import path from "path";

const widgetDir = import.meta.dirname;
const targetFile = path.join(widgetDir, "dist/vouchreel-widget.js");

if (!fs.existsSync(targetFile)) {
  console.error(`Error: Build file not found at ${targetFile}`);
  process.exit(1);
}

const rawBuffer = fs.readFileSync(targetFile);
const gzippedBuffer = zlib.gzipSync(rawBuffer);

const rawSizeKb = (rawBuffer.length / 1024).toFixed(2);
const gzipSizeKb = (gzippedBuffer.length / 1024).toFixed(2);

const MAX_GZIP_BYTES = 15 * 1024; // 15 KB = 15,360 bytes

console.log(`Bundle Size Summary:`);
console.log(`  Raw size:    ${rawSizeKb} KB (${rawBuffer.length} bytes)`);
console.log(`  Gzip size:   ${gzipSizeKb} KB (${gzippedBuffer.length} bytes)`);
console.log(`  Size budget: 15.00 KB (${MAX_GZIP_BYTES} bytes)`);

if (gzippedBuffer.length > MAX_GZIP_BYTES) {
  console.error(`\n❌ BUILD FAILED: Gzipped bundle size exceeds 15 KB limit!`);
  process.exit(1);
} else {
  console.log(`\n✓ PASS: Bundle size is within the 15 KB budget (${(gzippedBuffer.length / MAX_GZIP_BYTES * 100).toFixed(1)}% of budget used).`);
}
