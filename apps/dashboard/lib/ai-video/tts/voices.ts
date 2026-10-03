import type { TtsVoice } from "./types";

/**
 * Curated narration voices. These are stock library voices, never clones of a customer.
 * Override the provider ids per deployment with ELEVENLABS_VOICE_WARM / ELEVENLABS_VOICE_CLEAR.
 */
export const VOICES: TtsVoice[] = [
  {
    id: "warm",
    label: "Warm (female)",
    providerVoiceId: process.env.ELEVENLABS_VOICE_WARM ?? "21m00Tcm4TlvDq8ikWAM",
  },
  {
    id: "clear",
    label: "Clear (male)",
    providerVoiceId: process.env.ELEVENLABS_VOICE_CLEAR ?? "pNInz6obpgDQGcFmaJgB",
  },
];

export function getVoice(id: string): TtsVoice | undefined {
  return VOICES.find((v) => v.id === id);
}
