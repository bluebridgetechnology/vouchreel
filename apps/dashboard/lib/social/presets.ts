export type SocialPlatform = "tiktok" | "reels" | "shorts";
export type FramingMode = "blur" | "letterbox";
export type WatermarkPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export interface PlatformPreset {
  id: SocialPlatform;
  name: string;
  width: number;
  height: number;
  aspectRatio: "9:16";
  maxDurationSeconds: number;
  fps: number;
  badge: string;
  description: string;
}

export const PLATFORM_PRESETS: Record<SocialPlatform, PlatformPreset> = {
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDurationSeconds: 60,
    fps: 30,
    badge: "9:16 • 1080×1920 • Up to 60s",
    description: "Vertical video optimized for TikTok algorithm with safe-zone captions",
  },
  reels: {
    id: "reels",
    name: "Instagram Reels",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDurationSeconds: 90,
    fps: 30,
    badge: "9:16 • 1080×1920 • Up to 90s",
    description: "Optimized for Instagram Explore and Reels tab with high-clarity encoding",
  },
  shorts: {
    id: "shorts",
    name: "YouTube Shorts",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDurationSeconds: 60,
    fps: 30,
    badge: "9:16 • 1080×1920 • Up to 60s",
    description: "Formatted for YouTube Shorts feed with high audio fidelity",
  },
};
