import { spawn } from "child_process";
import { existsSync } from "fs";

/**
 * Single entry point for running FFmpeg: availability check, friendly errors,
 * timeouts and captured stderr. Used by the transcode and social-export pipelines.
 *
 * FFmpeg must be installed on the host (the production Docker image installs it;
 * locally use `winget install Gyan.FFmpeg`, `brew install ffmpeg` or `apt install ffmpeg`).
 * Serverless hosts such as Vercel cannot run it; media jobs need a VPS/worker deployment.
 */

export const FFMPEG_MISSING_MESSAGE =
  "Video processing is unavailable because FFmpeg is not installed on this server.";

export class FfmpegUnavailableError extends Error {
  constructor(message = FFMPEG_MISSING_MESSAGE) {
    super(message);
    this.name = "FfmpegUnavailableError";
  }
}

export interface FfmpegStatus {
  available: boolean;
  version?: string;
  /** Whether the drawtext filter (needed for burned-in captions) is compiled in. */
  drawtext?: boolean;
  error?: string;
}

const bin = () => process.env.FFMPEG_PATH || "ffmpeg";

function capture(args: string[], timeoutMs = 8_000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (out += d));
    proc.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
  });
}

let cached: { at: number; status: FfmpegStatus } | null = null;

/** Probes the host for FFmpeg (cached for 30s so health checks stay cheap). */
export async function getFfmpegStatus(force = false): Promise<FfmpegStatus> {
  if (!force && cached && Date.now() - cached.at < 30_000) return cached.status;
  let status: FfmpegStatus;
  try {
    const version = await capture(["-hide_banner", "-version"]);
    if (version.code !== 0) throw new Error(`ffmpeg -version exited with ${version.code}`);
    const filters = await capture(["-hide_banner", "-filters"]).catch(() => ({ code: 1, out: "" }));
    status = {
      available: true,
      version: /ffmpeg version (\S+)/.exec(version.out)?.[1],
      drawtext: /\bdrawtext\b/.test(filters.out),
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    status = { available: false, error: code === "ENOENT" ? FFMPEG_MISSING_MESSAGE : (err as Error).message };
  }
  cached = { at: Date.now(), status };
  return status;
}

export async function ensureFfmpeg(): Promise<void> {
  const status = await getFfmpegStatus();
  if (!status.available) throw new FfmpegUnavailableError(status.error);
}

export interface RunFfmpegOptions {
  /** Kill the process after this many ms (default 5 minutes). */
  timeoutMs?: number;
}

/** Runs FFmpeg to completion. Rejects with FfmpegUnavailableError if it is not installed. */
export function runFfmpeg(args: string[], options: RunFfmpegOptions = {}): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 5 * 60_000;
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(bin(), ["-hide_banner", "-nostdin", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeoutMs);
    proc.stderr.on("data", (d) => {
      stderr = (stderr + d).slice(-4000);
    });
    proc.once("error", (err) => {
      clearTimeout(timer);
      cached = null;
      reject((err as NodeJS.ErrnoException).code === "ENOENT" ? new FfmpegUnavailableError() : err);
    });
    proc.once("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error(`FFmpeg timed out after ${Math.round(timeoutMs / 1000)}s`));
      if (code === 0) return resolve();
      const tail = stderr.trim().split("\n").slice(-3).join(" | ");
      reject(new Error(`FFmpeg failed (exit ${code})${tail ? `: ${tail}` : ""}`));
    });
  });
}

const FONT_CANDIDATES = [
  "/usr/share/fonts/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "C:/Windows/Fonts/arialbd.ttf",
  "C:/Windows/Fonts/arial.ttf",
];

/** Font file for drawtext: FFMPEG_FONT_FILE, else the first known system font. */
export function resolveFontFile(): string | undefined {
  const fromEnv = process.env.FFMPEG_FONT_FILE;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return FONT_CANDIDATES.find((p) => existsSync(p));
}

/** Escapes a path for use inside a drawtext `fontfile='...'` option. */
export function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

/** User-safe description of an FFmpeg failure (raw stderr stays in server logs). */
export function friendlyMediaError(error: unknown): string {
  if (error instanceof FfmpegUnavailableError) return error.message;
  const msg = error instanceof Error ? error.message : "";
  if (/timed out/i.test(msg)) return "Video processing took too long and was stopped.";
  if (/exceeds .* limit/i.test(msg)) return msg;
  return "Video processing failed. Please try again or upload a different file.";
}
