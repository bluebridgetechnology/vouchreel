import { describe, expect, it, vi, afterEach } from "vitest";
import { escapeFilterPath, friendlyMediaError, FfmpegUnavailableError, FFMPEG_MISSING_MESSAGE, getFfmpegStatus, runFfmpeg } from "../ffmpeg";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ffmpeg helpers", () => {
  it("escapes Windows font paths for drawtext", () => {
    expect(escapeFilterPath("C:\\Windows\\Fonts\\arial.ttf")).toBe("C\\:/Windows/Fonts/arial.ttf");
  });

  it("maps errors to user-safe messages", () => {
    expect(friendlyMediaError(new FfmpegUnavailableError())).toBe(FFMPEG_MISSING_MESSAGE);
    expect(friendlyMediaError(new Error("FFmpeg timed out after 300s"))).toMatch(/too long/);
    expect(friendlyMediaError(new Error("FFmpeg failed (exit 1): secret path /tmp/x"))).not.toMatch(/secret/);
  });

  it("reports a missing binary instead of throwing", async () => {
    vi.stubEnv("FFMPEG_PATH", "definitely-not-a-real-ffmpeg-binary");
    const status = await getFfmpegStatus(true);
    expect(status.available).toBe(false);
    expect(status.error).toBe(FFMPEG_MISSING_MESSAGE);
    await expect(runFfmpeg(["-version"])).rejects.toBeInstanceOf(FfmpegUnavailableError);
  });
});
