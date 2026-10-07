/**
 * Finds (and with --delete removes) files in storage that no database row points at.
 *   npm run storage:prune -w @vouchreel/dashboard                       # report only
 *   npm run storage:prune -w @vouchreel/dashboard -- --delete           # delete them
 *   npm run storage:prune -w @vouchreel/dashboard -- --older-than-hours=72
 * Files newer than the grace period (default 24 hours) are never touched. Needs DATABASE_URL and the
 * STORAGE_* settings of the deployment you are cleaning.
 */
import { deleteOrphanedFiles, findOrphanedFiles } from "../lib/storage/orphans";

const args = process.argv.slice(2);
const doDelete = args.includes("--delete");
const hours = Number(args.find((a) => a.startsWith("--older-than-hours="))?.split("=")[1] ?? 24);
if (!Number.isFinite(hours) || hours < 1) {
  console.error("--older-than-hours must be a number of at least 1");
  process.exit(1);
}

const report = await findOrphanedFiles({ graceMs: hours * 3_600_000 });
const bytes = report.orphans.reduce((n, f) => n + f.size, 0);
console.log(`Scanned ${report.scanned} files: ${report.referenced} in use, ${report.tooNew} newer than ${hours}h, ${report.orphans.length} orphaned (${(bytes / 1_048_576).toFixed(1)} MB).`);
for (const file of report.orphans.slice(0, 50)) console.log(`  ${file.key}  ${file.size} bytes  ${file.lastModified.toISOString()}`);
if (report.orphans.length > 50) console.log(`  ... and ${report.orphans.length - 50} more`);

if (!doDelete) {
  if (report.orphans.length) console.log("Nothing was deleted. Run again with --delete to remove them.");
} else {
  const result = await deleteOrphanedFiles(report.orphans);
  console.log(`Deleted ${result.deleted} files.`);
  for (const f of result.failed) console.error(`  could not delete ${f.key}: ${f.error}`);
  if (result.failed.length) process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
