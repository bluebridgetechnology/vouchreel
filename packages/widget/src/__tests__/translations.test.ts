import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  detectVisitorLocale,
  resolveTestimonialTranslation,
  TestimonialItem,
} from "../matcher";
import { createVideoPlayer } from "../player";

describe("Widget Multi-Language Translations", () => {
  let docLang = "";
  let navLang = "en";

  beforeEach(() => {
    docLang = "";
    navLang = "en";

    const mockDocument: any = {
      get documentElement() {
        return { lang: docLang };
      },
      createElement: (tag: string) => {
        const listeners: Record<string, ((...args: any[]) => void)[]> = {};
        const el: any = {
          tagName: tag.toUpperCase(),
          style: {},
          className: "",
          innerHTML: "",
          textContent: "",
          children: [] as any[],
          appendChild: (child: any) => {
            el.children.push(child);
            return child;
          },
          setAttribute: vi.fn(),
          getAttribute: vi.fn(),
          addEventListener: (event: string, handler: (...args: any[]) => void) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
          },
          dispatchEvent: (event: any) => {
            const handlers = listeners[event.type || event] || [];
            handlers.forEach((h) => h(event));
          },
          remove: vi.fn(),
          querySelector: (selector: string) => {
            if (selector === ".vr-player-subtitles") {
              return el.children.find((c: any) => c.className === "vr-player-subtitles");
            }
            if (selector === "video") {
              return el.children.find((c: any) => c.tagName === "VIDEO");
            }
            return null;
          },
          play: vi.fn().mockResolvedValue(undefined),
          pause: vi.fn(),
        };
        return el;
      },
      getElementById: vi.fn(),
      querySelector: vi.fn(),
    };

    const mockNavigator = {
      get language() {
        return navLang;
      },
    };

    vi.stubGlobal("document", mockDocument);
    vi.stubGlobal("navigator", mockNavigator);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("detectVisitorLocale", () => {
    it("detects language from document.documentElement.lang", () => {
      docLang = "es-ES";
      expect(detectVisitorLocale()).toBe("es");

      docLang = "fr";
      expect(detectVisitorLocale()).toBe("fr");
    });

    it("falls back to navigator.language when documentElement.lang is empty", () => {
      docLang = "";
      navLang = "de-DE";
      expect(detectVisitorLocale()).toBe("de");
    });

    it("defaults to 'en' when neither is set", () => {
      docLang = "";
      navLang = "";
      expect(detectVisitorLocale()).toBe("en");
    });
  });

  describe("resolveTestimonialTranslation", () => {
    const testimonial: TestimonialItem = {
      id: "t-1",
      videoUrl: "https://example.com/video.mp4",
      platform: "mp4",
      quote: "Original English quote",
      translations: [
        {
          language: "es",
          quote: "Cita en español",
          transcript: [
            { start: 0, end: 5, text: "Hola mundo" },
            { start: 5, end: 10, text: "Gracias por todo" },
          ],
        },
        {
          language: "fr",
          quote: "Citation en français",
          transcript: [{ start: 0, end: 5, text: "Bonjour le monde" }],
        },
      ],
    };

    it("finds matching translation from array case-insensitively", () => {
      const match = resolveTestimonialTranslation(testimonial, "ES");
      expect(match).toBeDefined();
      expect(match?.quote).toBe("Cita en español");
      expect(match?.transcript).toHaveLength(2);
    });

    it("returns null when translation is not available", () => {
      const match = resolveTestimonialTranslation(testimonial, "de");
      expect(match).toBeNull();
    });

    it("handles dictionary map format", () => {
      const dictTestimonial: TestimonialItem = {
        id: "t-2",
        videoUrl: "https://example.com/video.mp4",
        platform: "mp4",
        quote: "English original",
        translations: {
          de: {
            quote: "Deutsches Zitat",
            transcript: [{ start: 0, end: 4, text: "Hallo Welt" }],
          },
        },
      };

      const match = resolveTestimonialTranslation(dictTestimonial, "de");
      expect(match).toBeDefined();
      expect(match?.quote).toBe("Deutsches Zitat");
    });
  });

  describe("createVideoPlayer with Subtitles", () => {
    it("mounts subtitle overlay and updates cue on video timeupdate", () => {
      const container: any = (document as any).createElement("div");

      const cues = [
        { start: 0, end: 3, text: "Welcome to Vouchreel" },
        { start: 3.1, end: 6, text: "Collect video reviews easily" },
      ];

      const player = createVideoPlayer({
        container,
        videoUrl: "https://example.com/sample.mp4",
        platform: "mp4",
        subtitles: cues,
      });

      player.play();

      const subtitleEl = container.querySelector(".vr-player-subtitles");
      expect(subtitleEl).toBeTruthy();
      expect(subtitleEl.style.display).toBe("none");

      const videoEl = container.querySelector("video");
      expect(videoEl).toBeTruthy();

      // Simulate playback time at 1.5 seconds
      videoEl.currentTime = 1.5;
      videoEl.dispatchEvent({ type: "timeupdate" });

      expect(subtitleEl.textContent).toBe("Welcome to Vouchreel");
      expect(subtitleEl.style.display).toBe("block");

      // Advance to 4.0 seconds
      videoEl.currentTime = 4.0;
      videoEl.dispatchEvent({ type: "timeupdate" });
      expect(subtitleEl.textContent).toBe("Collect video reviews easily");

      // Advance beyond cues
      videoEl.currentTime = 10.0;
      videoEl.dispatchEvent({ type: "timeupdate" });
      expect(subtitleEl.style.display).toBe("none");

      player.destroy();
      expect(container.innerHTML).toBe("");
    });
  });
});
