import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MockTranslationProvider,
  GoogleTranslateProvider,
  DeepLProvider,
  getTranslationProvider,
  TranslationNotConfiguredError,
  getOrTranslateTestimonial,
} from "../index";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

describe("Translation Providers and Factory", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DEEPL_API_KEY;
    delete process.env.GOOGLE_TRANSLATE_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("MockTranslationProvider", () => {
    const provider = new MockTranslationProvider();

    it("has name 'mock'", () => {
      expect(provider.name).toBe("mock");
    });

    it("translates text with uppercase language prefix", async () => {
      const result = await provider.translateText("Amazing product!", "es");
      expect(result).toBe("[ES] Amazing product!");

      const french = await provider.translateText("Very helpful service", "fr");
      expect(french).toBe("[FR] Very helpful service");
    });

    it("handles empty text gracefully", async () => {
      expect(await provider.translateText("", "es")).toBe("");
    });

    it("translates transcript cues while preserving timestamps", async () => {
      const cues = [
        { start: 0, end: 3.5, text: "Welcome to Vouchreel" },
        { start: 3.5, end: 7.2, text: "It simplifies collecting video reviews" },
      ];

      const translated = await provider.translateTranscript(cues, "de");
      expect(translated).toEqual([
        { start: 0, end: 3.5, text: "[DE] Welcome to Vouchreel" },
        { start: 3.5, end: 7.2, text: "[DE] It simplifies collecting video reviews" },
      ]);
    });

    it("returns empty array for empty transcript cues", async () => {
      expect(await provider.translateTranscript([], "es")).toEqual([]);
    });
  });

  describe("GoogleTranslateProvider", () => {
    it("throws if API key is not configured", async () => {
      const provider = new GoogleTranslateProvider("");
      await expect(provider.translateText("Hello", "es")).rejects.toThrow(
        "GOOGLE_TRANSLATE_API_KEY is not configured"
      );
    });

    it("translates text using Google Translate REST endpoint", async () => {
      const provider = new GoogleTranslateProvider("test-google-key");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: "¡Hola Mundo!" }],
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await provider.translateText("Hello World!", "es");
      expect(result).toBe("¡Hola Mundo!");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://translation.googleapis.com/language/translate/v2?key=test-google-key",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: "Hello World!",
            target: "es",
            format: "text",
          }),
        })
      );
    });

    it("translates transcript cues in batch", async () => {
      const provider = new GoogleTranslateProvider("test-google-key");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [
              { translatedText: "Bienvenue" },
              { translatedText: "Merci beaucoup" },
            ],
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const cues = [
        { start: 0, end: 2, text: "Welcome" },
        { start: 2, end: 5, text: "Thank you" },
      ];

      const result = await provider.translateTranscript(cues, "fr");
      expect(result).toEqual([
        { start: 0, end: 2, text: "Bienvenue" },
        { start: 2, end: 5, text: "Merci beaucoup" },
      ]);
    });

    it("handles API error responses", async () => {
      const provider = new GoogleTranslateProvider("bad-key");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "API key not valid",
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(provider.translateText("Hello", "es")).rejects.toThrow(
        "Google Translate API error (403): API key not valid"
      );
    });
  });

  describe("DeepLProvider", () => {
    it("throws if API key is not configured", async () => {
      const provider = new DeepLProvider("");
      await expect(provider.translateText("Hello", "es")).rejects.toThrow(
        "DEEPL_API_KEY is not configured"
      );
    });

    it("uses free API endpoint when key ends with :fx", async () => {
      const provider = new DeepLProvider("my-test-key:fx");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [{ text: "Hola Mundo" }],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const res = await provider.translateText("Hello World", "es");
      expect(res).toBe("Hola Mundo");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api-free.deepl.com/v2/translate",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "DeepL-Auth-Key my-test-key:fx",
          }),
        })
      );
    });

    it("uses pro API endpoint for non-:fx keys", async () => {
      const provider = new DeepLProvider("pro-api-key");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [{ text: "Hallo Welt" }],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await provider.translateText("Hello World", "de");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.deepl.com/v2/translate",
        expect.anything()
      );
    });

    it("translates transcript cues in batch", async () => {
      const provider = new DeepLProvider("pro-api-key");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [
            { text: "Erster Teil" },
            { text: "Zweiter Teil" },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const cues = [
        { start: 0, end: 3, text: "First part" },
        { start: 3, end: 6, text: "Second part" },
      ];

      const res = await provider.translateTranscript(cues, "de");
      expect(res).toEqual([
        { start: 0, end: 3, text: "Erster Teil" },
        { start: 3, end: 6, text: "Zweiter Teil" },
      ]);
    });
  });

  describe("getTranslationProvider Factory", () => {
    it("returns DeepLProvider when DEEPL_API_KEY is configured", () => {
      process.env.DEEPL_API_KEY = "dummy-deepl-key";
      const provider = getTranslationProvider();
      expect(provider.name).toBe("deepl");
    });

    it("returns GoogleTranslateProvider when GOOGLE_TRANSLATE_API_KEY is configured", () => {
      process.env.GOOGLE_TRANSLATE_API_KEY = "dummy-google-key";
      const provider = getTranslationProvider();
      expect(provider.name).toBe("google");
    });

    it("falls back to MockTranslationProvider when no keys are configured", () => {
      const provider = getTranslationProvider();
      expect(provider.name).toBe("mock");
    });

    it("in production without a key it refuses instead of returning fake translations", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(() => getTranslationProvider()).toThrow(TranslationNotConfiguredError);
      vi.stubEnv("TRANSLATION_ALLOW_MOCK", "1");
      expect(getTranslationProvider().name).toBe("mock");
      vi.unstubAllEnvs();
    });

    it("returns requested provider explicitly by name", () => {
      expect(getTranslationProvider("mock").name).toBe("mock");
      expect(getTranslationProvider("google").name).toBe("google");
      expect(getTranslationProvider("deepl").name).toBe("deepl");
    });
  });

  describe("getOrTranslateTestimonial Manager", () => {
    it("returns cached translation if one already exists in database", async () => {
      const cached = {
        id: "trans-cached-1",
        testimonialId: "testi-1",
        language: "es",
        quote: "[ES] Cached quote",
        transcript: [{ start: 0, end: 5, text: "[ES] Cached cue" }],
        provider: "mock",
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([cached]),
        }),
      });

      const result = await getOrTranslateTestimonial("testi-1", "es");
      expect(result).toEqual(cached);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("fetches source testimonial, translates, inserts into DB, and returns translation if not cached", async () => {
      const mockTestimonial = {
        id: "testi-1",
        quote: "This product is fantastic!",
        durationSeconds: 15,
        transcriptUrl: null,
      };

      // 1. Cache lookup returns empty
      // 2. Testimonial lookup returns mockTestimonial
      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockTestimonial]),
          }),
        });

      const insertedRecord = {
        id: "trans-new-1",
        testimonialId: "testi-1",
        language: "es",
        quote: "[ES] This product is fantastic!",
        transcript: [
          { start: 0, end: 15, text: "[ES] This product is fantastic!" },
        ],
        provider: "mock",
      };

      const insertMock = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([insertedRecord]),
      });
      (db.insert as any).mockReturnValue({ values: insertMock });

      const result = await getOrTranslateTestimonial("testi-1", "es");
      expect(result).toEqual(insertedRecord);
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          testimonialId: "testi-1",
          language: "es",
          quote: "[ES] This product is fantastic!",
          provider: "mock",
        })
      );
    });

    it("throws error if testimonial is not found", async () => {
      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      await expect(getOrTranslateTestimonial("unknown-id", "es")).rejects.toThrow(
        "Testimonial not found: unknown-id"
      );
    });
  });
});
