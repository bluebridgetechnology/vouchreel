export type AiVideoAspect = "9:16" | "16:9";

export interface AiVideoTemplate {
  id: string;
  label: string;
  /** Hex without #, for FFmpeg colour options. */
  background: string;
  text: string;
  /** Used for the attribution line and watermark. */
  muted: string;
}

/** Motion-graphic quote templates. No faces or likenesses: type and colour only. */
export const AI_VIDEO_TEMPLATES: AiVideoTemplate[] = [
  { id: "bold", label: "Bold", background: "cf3d0b", text: "ffffff", muted: "ffe3d9" },
  { id: "midnight", label: "Midnight", background: "111827", text: "f9fafb", muted: "9ca3af" },
  { id: "paper", label: "Paper", background: "f6f1e9", text: "1f1a14", muted: "6b6257" },
];

export function getTemplate(id: string): AiVideoTemplate | undefined {
  return AI_VIDEO_TEMPLATES.find((t) => t.id === id);
}

export const ASPECT_DIMENSIONS: Record<AiVideoAspect, { width: number; height: number; fontSize: number; maxLineChars: number }> = {
  "9:16": { width: 1080, height: 1920, fontSize: 76, maxLineChars: 20 },
  "16:9": { width: 1920, height: 1080, fontSize: 68, maxLineChars: 38 },
};

/** The disclosure burned into every generated video, regardless of plan. */
export const AI_VIDEO_LABEL = "AI-generated from a written review";
