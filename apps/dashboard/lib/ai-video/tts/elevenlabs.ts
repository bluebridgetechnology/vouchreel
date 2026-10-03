import { TtsError, type TtsProvider, type TtsRequest, type TtsResult } from "./types";
import { getVoice } from "./voices";
import { wordsFromCharacterAlignment } from "./words";

const API_BASE = "https://api.elevenlabs.io/v1";
const MODEL_ID = "eleven_multilingual_v2";
const REQUEST_TIMEOUT_MS = 60_000;
/** Rough list price per 1,000 characters; override with ELEVENLABS_COST_CENTS_PER_1K. */
const DEFAULT_COST_CENTS_PER_1K = 30;

interface AlignmentResponse {
  audio_base64?: string;
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  } | null;
}

export class ElevenLabsProvider implements TtsProvider {
  readonly name = "elevenlabs";

  constructor(private readonly apiKey = process.env.ELEVENLABS_API_KEY) {
    if (!this.apiKey) throw new Error("ELEVENLABS_API_KEY is required for the ElevenLabs provider");
  }

  async synthesize({ text, voiceId }: TtsRequest): Promise<TtsResult> {
    const voice = getVoice(voiceId);
    if (!voice) throw new TtsError(`Unknown voice "${voiceId}"`, "That voice is not available.", false);

    let response: Response;
    try {
      response = await fetch(
        `${API_BASE}/text-to-speech/${voice.providerVoiceId}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": this.apiKey!, "Content-Type": "application/json" },
          body: JSON.stringify({ text, model_id: MODEL_ID }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }
      );
    } catch (error) {
      throw new TtsError(
        `ElevenLabs request failed: ${error instanceof Error ? error.message : String(error)}`,
        "The voice service did not respond. Please try again.",
        true
      );
    }

    if (!response.ok) throw await errorFromResponse(response);

    const data = (await response.json()) as AlignmentResponse;
    if (!data.audio_base64 || !data.alignment) {
      throw new TtsError("ElevenLabs response missing audio or alignment", "The voice service returned an unexpected response.", true);
    }

    const words = wordsFromCharacterAlignment(data.alignment);
    const durationSeconds = Math.max(0, ...data.alignment.character_end_times_seconds);
    const characters = text.length;
    const centsPer1k = Number(process.env.ELEVENLABS_COST_CENTS_PER_1K ?? DEFAULT_COST_CENTS_PER_1K);

    return {
      audio: Buffer.from(data.audio_base64, "base64"),
      mimeType: "audio/mpeg",
      words,
      durationSeconds,
      characters,
      costCents: Math.ceil((characters / 1000) * centsPer1k),
    };
  }
}

async function errorFromResponse(response: Response): Promise<TtsError> {
  const detail = (await response.text().catch(() => "")).slice(0, 300);
  const message = `ElevenLabs ${response.status}: ${detail}`;
  if (response.status === 401 || response.status === 403) {
    return new TtsError(message, "Voice generation is not configured correctly. Contact support.", false);
  }
  if (response.status === 402 || response.status === 429) {
    return new TtsError(message, "The voice service is busy or out of quota. Please try again later.", true);
  }
  if (response.status >= 500) {
    return new TtsError(message, "The voice service had an error. Please try again.", true);
  }
  return new TtsError(message, "The voice service rejected this text.", false);
}
