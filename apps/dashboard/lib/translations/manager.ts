import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { testimonials, testimonialTranslations } from "@/lib/db/schema";
import { getTranslationProvider } from "./index";
import { TranscriptCue, TranslationProvider } from "./types";

export interface GetOrTranslateOptions {
  provider?: TranslationProvider;
  sourceTranscript?: Array<TranscriptCue>;
  forceRefresh?: boolean;
}

/**
 * Retrieves a cached translation from testimonial_translations or calls the configured
 * translation provider to translate quote and transcript cues and caches the result.
 */
export async function getOrTranslateTestimonial(
  testimonialId: string,
  targetLang: string,
  options?: GetOrTranslateOptions
) {
  const normLang = targetLang.trim().toLowerCase();

  // 1. Check existing translation in cache
  if (!options?.forceRefresh) {
    const [cached] = await db
      .select()
      .from(testimonialTranslations)
      .where(
        and(
          eq(testimonialTranslations.testimonialId, testimonialId),
          eq(testimonialTranslations.language, normLang)
        )
      );

    if (cached) {
      return cached;
    }
  }

  // 2. Fetch source testimonial
  const [testimonial] = await db
    .select()
    .from(testimonials)
    .where(eq(testimonials.id, testimonialId));

  if (!testimonial) {
    throw new Error(`Testimonial not found: ${testimonialId}`);
  }

  // 3. Resolve translation provider
  const provider = options?.provider || getTranslationProvider();

  // 4. Resolve source transcript cues
  let sourceCues: Array<TranscriptCue> = [];
  if (options?.sourceTranscript && options.sourceTranscript.length > 0) {
    sourceCues = options.sourceTranscript;
  } else if (testimonial.transcriptUrl) {
    try {
      const urlStr = testimonial.transcriptUrl.trim();
      if (urlStr.startsWith("[") && urlStr.endsWith("]")) {
        sourceCues = JSON.parse(urlStr);
      } else if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
        const res = await fetch(urlStr);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) {
            sourceCues = json;
          } else if (Array.isArray(json?.cues)) {
            sourceCues = json.cues;
          }
        }
      }
    } catch {
      // Ignore transcript fetch/parse errors and fall back gracefully
    }
  }

  // If no transcript cues exist, but quote exists, create a default cue spanning duration
  if (sourceCues.length === 0 && testimonial.quote) {
    sourceCues = [
      {
        start: 0,
        end: testimonial.durationSeconds || 10,
        text: testimonial.quote,
      },
    ];
  }

  // 5. Translate quote and cues
  let translatedQuote: string | null = null;
  if (testimonial.quote) {
    translatedQuote = await provider.translateText(testimonial.quote, normLang);
  }

  let translatedTranscript: Array<TranscriptCue> | null = null;
  if (sourceCues.length > 0) {
    translatedTranscript = await provider.translateTranscript(sourceCues, normLang);
  }

  // 6. Cache into testimonial_translations
  const [record] = await db
    .insert(testimonialTranslations)
    .values({
      testimonialId,
      language: normLang,
      quote: translatedQuote,
      transcript: translatedTranscript,
      provider: provider.name,
    })
    .returning();

  return record;
}
