import { TranslationProvider, TranscriptCue } from "./types";

/**
 * Mock translation provider for testing and deterministic offline fallback.
 * Prefixes text with target language code in uppercase, e.g. "[ES] Hello world".
 */
export class MockTranslationProvider implements TranslationProvider {
  readonly name = "mock";

  async translateText(text: string, targetLang: string, _sourceLang?: string): Promise<string> {
    if (!text) return text;
    const prefix = `[${targetLang.toUpperCase()}]`;
    return `${prefix} ${text}`;
  }

  async translateTranscript(
    cues: Array<TranscriptCue>,
    targetLang: string,
    _sourceLang?: string
  ): Promise<Array<TranscriptCue>> {
    if (!cues || cues.length === 0) return [];
    const prefix = `[${targetLang.toUpperCase()}]`;
    return cues.map((cue) => ({
      start: cue.start,
      end: cue.end,
      text: `${prefix} ${cue.text}`,
    }));
  }
}

/**
 * Google Cloud Translation API provider using REST endpoint with API key.
 */
export class GoogleTranslateProvider implements TranslationProvider {
  readonly name = "google";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_TRANSLATE_API_KEY || "";
  }

  async translateText(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GOOGLE_TRANSLATE_API_KEY is not configured");
    }
    if (!text) return text;

    const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        ...(sourceLang ? { source: sourceLang } : {}),
        format: "text",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Translate API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data?.data?.translations?.[0]?.translatedText || text;
  }

  async translateTranscript(
    cues: Array<TranscriptCue>,
    targetLang: string,
    sourceLang?: string
  ): Promise<Array<TranscriptCue>> {
    if (!this.apiKey) {
      throw new Error("GOOGLE_TRANSLATE_API_KEY is not configured");
    }
    if (!cues || cues.length === 0) return [];

    const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: cues.map((c) => c.text),
        target: targetLang,
        ...(sourceLang ? { source: sourceLang } : {}),
        format: "text",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Translate API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const translations = data?.data?.translations || [];

    return cues.map((cue, idx) => ({
      start: cue.start,
      end: cue.end,
      text: translations[idx]?.translatedText || cue.text,
    }));
  }
}

/**
 * DeepL API provider supporting both Free and Pro endpoints.
 */
export class DeepLProvider implements TranslationProvider {
  readonly name = "deepl";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DEEPL_API_KEY || "";
  }

  private getEndpoint(): string {
    return this.apiKey.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";
  }

  async translateText(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("DEEPL_API_KEY is not configured");
    }
    if (!text) return text;

    const url = this.getEndpoint();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang.toUpperCase(),
        ...(sourceLang ? { source_lang: sourceLang.toUpperCase() } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data?.translations?.[0]?.text || text;
  }

  async translateTranscript(
    cues: Array<TranscriptCue>,
    targetLang: string,
    sourceLang?: string
  ): Promise<Array<TranscriptCue>> {
    if (!this.apiKey) {
      throw new Error("DEEPL_API_KEY is not configured");
    }
    if (!cues || cues.length === 0) return [];

    const url = this.getEndpoint();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: cues.map((c) => c.text),
        target_lang: targetLang.toUpperCase(),
        ...(sourceLang ? { source_lang: sourceLang.toUpperCase() } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const translations = data?.translations || [];

    return cues.map((cue, idx) => ({
      start: cue.start,
      end: cue.end,
      text: translations[idx]?.text || cue.text,
    }));
  }
}
