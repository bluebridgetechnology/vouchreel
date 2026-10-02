import { mkdtemp, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getFfmpegStatus, resolveFontFile, runFfmpeg } from "../ffmpeg";
import { buildFfmpegArgs } from "@/lib/social/pipeline";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/storage", () => ({ getStorage: vi.fn() }));

/**
 * Runs real FFmpeg end to end (synthetic source, no network). Skipped automatically on
 * machines without FFmpeg so unit-test runs stay green; CI should install it.
 */
const status = await getFfmpegStatus(true);

describe.skipIf(!status.available)("ffmpeg integration", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "vouchreel-ffmpeg-test-"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("transcodes a clip to H.264 mp4", async () => {
    const src = path.join(dir, "src.mp4");
    const out = path.join(dir, "out.mp4");
    await runFfmpeg(["-f", "lavfi", "-i", "testsrc=duration=1:size=320x240:rate=15", "-f", "lavfi", "-i", "sine=duration=1", "-shortest", src]);
    await runFfmpeg(["-i", src, "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", out]);
    expect((await stat(out)).size).toBeGreaterThan(0);
  });

  it("renders a 9:16 social export with burned-in text", async () => {
    expect(status.drawtext).toBe(true);
    const src = path.join(dir, "social-src.mp4");
    const out = path.join(dir, "social-out.mp4");
    await runFfmpeg(["-f", "lavfi", "-i", "testsrc=duration=1:size=640x360:rate=15", "-f", "lavfi", "-i", "sine=duration=1", "-shortest", src]);
    const args = buildFfmpegArgs({
      sourcePath: src,
      outputPath: out,
      framing: "letterbox",
      customerName: "Ada Lovelace",
      customerCompany: "Analytical Engines",
      quote: "It just works",
      showWatermark: true,
      includeBranding: true,
      includeCaptions: true,
      fontFile: resolveFontFile(),
      maxDurationSeconds: 1,
    } as never);
    await runFfmpeg(args);
    expect((await stat(out)).size).toBeGreaterThan(0);
  }, 60_000);
});
