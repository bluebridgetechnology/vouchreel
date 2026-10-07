import { TranslationProvider } from "./types";
import {
  MockTranslationProvider,
  GoogleTranslateProvider,
  DeepLProvider,
} from "./providers";

export * from "./types";
export * from "./providers";
export * from "./manager";

/**
 * Returns the configured translation provider based on available environment variables
 * or explicit provider name. Without a key the mock provider ("[ES] text") is only used outside
 * production, or when TRANSLATION_ALLOW_MOCK=1: customers must never be shown fake translations.
 */
export class TranslationNotConfiguredError extends Error {
  constructor() {
    super("Translation is not configured: set DEEPL_API_KEY or GOOGLE_TRANSLATE_API_KEY.");
    this.name = "TranslationNotConfiguredError";
  }
}

export function getTranslationProvider(providerName?: string): TranslationProvider {
  if (providerName === "mock") {
    return new MockTranslationProvider();
  }
  if (providerName === "deepl") {
    return new DeepLProvider();
  }
  if (providerName === "google") {
    return new GoogleTranslateProvider();
  }

  // Automatic provider selection based on environment configuration
  if (process.env.DEEPL_API_KEY) {
    return new DeepLProvider();
  }
  if (process.env.GOOGLE_TRANSLATE_API_KEY) {
    return new GoogleTranslateProvider();
  }

  if (process.env.NODE_ENV === "production" && process.env.TRANSLATION_ALLOW_MOCK !== "1") {
    throw new TranslationNotConfiguredError();
  }
  return new MockTranslationProvider();
}
