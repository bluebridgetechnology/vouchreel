import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VouchreelWidget } from "../widget";
import type { TestimonialItem } from "../matcher";

/** A tiny stand-in for the DOM (the package tests run in node): records what is written as markup and as text. */
function installDom() {
  const html: string[] = [];
  const text: string[] = [];
  const created: any[] = [];
  const make = (tag: string) => {
    const el: any = {
      tag,
      className: "",
      children: [] as any[],
      attrs: {} as Record<string, string>,
      style: {} as Record<string, string>,
      removed: false,
      set innerHTML(v: string) {
        html.push(v);
      },
      get innerHTML() {
        return "";
      },
      set textContent(v: string) {
        text.push(v);
        el._text = v;
      },
      get textContent() {
        return el._text ?? "";
      },
      appendChild(c: any) {
        el.children.push(c);
        return c;
      },
      setAttribute(k: string, v: string) {
        el.attrs[k] = v;
      },
      addEventListener() {},
      remove() {
        el.removed = true;
      },
    };
    created.push(el);
    return el;
  };
  (globalThis as any).document = { createElement: make, documentElement: { lang: "en" } };
  return { html, text, created };
}

const widget = (over: Partial<ConstructorParameters<typeof VouchreelWidget>[0]> = {}) => new VouchreelWidget({ embedKey: "k", config: {}, testimonials: [], ...over }) as any;

describe("words from visitors and review sites are text on the customer's page, never markup", () => {
  const payload = `<img src=x onerror="alert(document.domain)">`;
  let dom: ReturnType<typeof installDom>;
  beforeEach(() => {
    dom = installDom();
  });
  afterEach(() => {
    delete (globalThis as any).document;
  });

  it("a video testimonial's name and company", () => {
    widget().createVideoCard({ id: "t", videoUrl: "https://v/x.mp4", platform: "mp4", customerName: payload, customerCompany: payload } as TestimonialItem, 0);
    expect(dom.html.join("")).not.toContain("onerror");
    expect(dom.text).toContain(payload);
  });

  it("a review card's author", () => {
    widget().createReviewCard({ id: "r", provider: "google", authorName: payload, rating: 5, text: "ok", reviewDate: null });
    expect(dom.html.join("")).not.toContain("onerror");
    expect(dom.text).toContain(payload);
  });
});

describe("a made video (review or AI) as a card", () => {
  let dom: ReturnType<typeof installDom>;
  beforeEach(() => {
    dom = installDom();
  });
  afterEach(() => {
    delete (globalThis as any).document;
  });

  const made: TestimonialItem = {
    id: "g1",
    videoUrl: "https://cdn.test/review-videos/s/g1.mp4",
    platform: "mp4",
    thumbnailUrl: null,
    quote: "Great experience!",
    customerName: "Alice M.",
    durationSeconds: 12,
    generated: "review",
    badge: "⭐ Review video",
  };

  it("shows its first frames instead of a poster, and says what it is", () => {
    widget().createVideoCard(made, 0);
    const frame = dom.created.find((e) => e.tag === "video");
    expect(frame).toMatchObject({ src: "https://cdn.test/review-videos/s/g1.mp4#t=1", preload: "metadata", muted: true });
    expect(dom.text).toContain("⭐ Review video");
    expect(dom.text).not.toContain("📹 Video Testimonial");
  });

  it("drops the whole card if its file is gone (a video that was taken down)", () => {
    const card = widget().createVideoCard(made, 0);
    expect(card.removed).toBe(false);
    dom.created.find((e) => e.tag === "video").onerror();
    expect(card.removed).toBe(true);
  });

  it("changes nothing for an ordinary testimonial: its poster image, its own label, no probe", () => {
    widget().createVideoCard({ id: "t", videoUrl: "https://v/x.mp4", platform: "mp4", thumbnailUrl: "https://v/x.jpg", customerName: "Jo" } as TestimonialItem, 0);
    expect(dom.created.some((e) => e.tag === "video")).toBe(false);
    expect(dom.created.find((e) => e.tag === "img").src).toBe("https://v/x.jpg");
    expect(dom.text).toContain("📹 Video Testimonial");
  });
});

