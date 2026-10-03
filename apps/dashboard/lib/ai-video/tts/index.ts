import { ElevenLabsProvider } from "./elevenlabs";
import { MockTtsProvider } from "./mock";
import type { TtsProvider } from "./types";

export * from "./types";
export { VOICES, getVoice } from "./voices";

/**
 * Picks the narration provider. Unlike translations, there is no silent mock fallback in
 * production: a customer must never receive a "generated" video that is actually silent.
 * Set AI_VIDEO_TTS_PROVIDER=mock to opt in explicitly (dev and tests).
 */
export function getTtsProvider(): TtsProvider {
  const requested = process.env.AI_VIDEO_TTS_PROVIDER;
  if (requested === "mock") return new MockTtsProvider();
  if (requested === "elevenlabs" || process.env.ELEVENLABS_API_KEY) return new ElevenLabsProvider();
  if (process.env.NODE_ENV === "production") {
    throw new Error("AI video narration is not configured: set ELEVENLABS_API_KEY (or AI_VIDEO_TTS_PROVIDER=mock).");
  }
  return new MockTtsProvider();
}

/** True when real narration is available, so the UI can hide the feature instead of failing. */
export function isTtsConfigured(): boolean {
  return process.env.AI_VIDEO_TTS_PROVIDER === "mock" || Boolean(process.env.ELEVENLABS_API_KEY) || process.env.NODE_ENV !== "production";
}
