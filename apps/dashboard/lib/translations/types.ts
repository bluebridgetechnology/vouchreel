export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
}

export interface TranslationProvider {
  readonly name: string;
  translateText(text: string, targetLang: string, sourceLang?: string): Promise<string>;
  translateTranscript(
    cues: Array<TranscriptCue>,
    targetLang: string,
    sourceLang?: string
  ): Promise<Array<TranscriptCue>>;
}

export interface TestimonialTranslationRecord {
  id: string;
  testimonialId: string;
  language: string;
  quote: string | null;
  transcript: unknown;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}
