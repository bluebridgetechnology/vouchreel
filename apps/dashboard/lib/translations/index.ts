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
 * or explicit provider name. Falls back to MockTranslationProvider when no keys are provided.
 */
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

  return new MockTranslationProvider();
}
