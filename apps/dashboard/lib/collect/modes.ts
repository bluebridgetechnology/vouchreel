/** Which testimonial types a collection form accepts. */
export const COLLECT_MODES = ["both", "video", "text"] as const;
export type CollectMode = (typeof COLLECT_MODES)[number];

export const COLLECT_MODE_LABELS: Record<CollectMode, string> = {
  both: "Video and written",
  video: "Video only",
  text: "Written only",
};

export const allowsVideo = (mode: CollectMode) => mode !== "text";
export const allowsText = (mode: CollectMode) => mode !== "video";
