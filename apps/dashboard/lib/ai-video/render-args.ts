import { escapeFilterPath } from "@/lib/media/ffmpeg";
import { ASPECT_DIMENSIONS, type AiVideoAspect, type AiVideoTemplate } from "./templates";

/** Seconds of silence-free hold after the narration ends. */
export const TAIL_SECONDS = 0.8;

export interface TimedTextFile {
  /** Path to a UTF-8 file holding the text; avoids all drawtext escaping problems. */
  textFile: string;
  start: number;
  end: number;
}

export interface AiVideoRenderPlan {
  audioPath: string;
  outputPath: string;
  template: AiVideoTemplate;
  aspect: AiVideoAspect;
  /** Narration length in seconds. */
  durationSeconds: number;
  captions: TimedTextFile[];
  attributionFile?: string;
  labelFile: string;
  watermarkFile?: string;
  fontFile?: string;
}

/** Breaks text onto lines of at most `maxChars`, splitting on spaces only. */
export function wrapText(text: string, maxChars: number): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

const secs = (n: number) => n.toFixed(3);

function drawtext(options: {
  file: string;
  fontFile?: string;
  size: number;
  color: string;
  x: string;
  y: string;
  alpha?: string;
  enable?: string;
  lineSpacing?: number;
}): string {
  const parts = [
    options.fontFile ? `fontfile='${escapeFilterPath(options.fontFile)}'` : "",
    `textfile='${escapeFilterPath(options.file)}'`,
    "reload=0",
    `fontsize=${options.size}`,
    `fontcolor=0x${options.color}`,
    `x=${options.x}`,
    `y=${options.y}`,
    options.lineSpacing ? `line_spacing=${options.lineSpacing}` : "",
    options.alpha ? `alpha='${options.alpha}'` : "",
    options.enable ? `enable='${options.enable}'` : "",
  ].filter(Boolean);
  return `drawtext=${parts.join(":")}`;
}

/**
 * FFmpeg arguments for a motion-graphic quote video: solid background, narration audio,
 * word-timed captions that fade in, an attribution line, a permanent AI-generated label and
 * an optional watermark.
 */
export function buildAiVideoArgs(plan: AiVideoRenderPlan): string[] {
  const { width, height, fontSize } = ASPECT_DIMENSIONS[plan.aspect];
  const total = plan.durationSeconds + TAIL_SECONDS;
  const { template, fontFile } = plan;
  const small = Math.round(fontSize * 0.42);
  const margin = Math.round(width * 0.04);

  const filters: string[] = [];

  for (const caption of plan.captions) {
    filters.push(
      drawtext({
        file: caption.textFile,
        fontFile,
        size: fontSize,
        color: template.text,
        x: "(w-text_w)/2",
        y: "(h-text_h)/2",
        lineSpacing: Math.round(fontSize * 0.25),
        enable: `between(t,${secs(caption.start)},${secs(caption.end)})`,
        alpha: `min(1,(t-${secs(caption.start)})/0.2)`,
      })
    );
  }

  if (plan.attributionFile) {
    filters.push(
      drawtext({
        file: plan.attributionFile,
        fontFile,
        size: small,
        color: template.muted,
        x: "(w-text_w)/2",
        y: `h-text_h-${Math.round(height * 0.12)}`,
        alpha: "min(1,t/0.6)",
      })
    );
  }

  // Disclosure: always present, never removable
  filters.push(
    drawtext({ file: plan.labelFile, fontFile, size: Math.round(small * 0.8), color: template.muted, x: "(w-text_w)/2", y: `${margin}` })
  );

  if (plan.watermarkFile) {
    filters.push(
      drawtext({
        file: plan.watermarkFile,
        fontFile,
        size: Math.round(small * 0.8),
        color: template.muted,
        x: "(w-text_w)/2",
        y: `h-text_h-${margin}`,
      })
    );
  }

  return [
    "-f",
    "lavfi",
    "-i",
    `color=c=0x${template.background}:s=${width}x${height}:r=30:d=${secs(total)}`,
    "-i",
    plan.audioPath,
    "-vf",
    filters.join(","),
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-t",
    secs(total),
    "-movflags",
    "+faststart",
    plan.outputPath,
  ];
}
