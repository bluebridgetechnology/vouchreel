export interface TtsVoice {
  /** Stable id stored in generated_videos.voice. */
  id: string;
  label: string;
  /** Provider-side voice id. */
  providerVoiceId: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface TtsRequest {
  text: string;
  voiceId: string;
}

export interface TtsResult {
  audio: Buffer;
  mimeType: "audio/mpeg" | "audio/wav";
  /** Per-word timings in seconds, used to time burned-in captions. */
  words: WordTiming[];
  durationSeconds: number;
  /** Characters billed by the provider. */
  characters: number;
  /** Estimated provider cost in cents, for margin tracking. */
  costCents: number;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(request: TtsRequest): Promise<TtsResult>;
}

export class TtsError extends Error {
  constructor(
    message: string,
    /** Safe to show to the account owner. */
    readonly userMessage: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "TtsError";
  }
}
