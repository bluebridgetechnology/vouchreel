import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutContext, LayoutDefinition } from "../layout-api";
import type { ReviewItem, TestimonialItem } from "../matcher";

/** Just enough DOM to render a layout (package tests run in node). */
function el(tag: string): any {
  const node: any = {
    tag,
    className: "",
    children: [] as any[],
    attrs: {} as Record<string, string>,
    listeners: {} as Record<string, () => void>,
    textContent: "",
    appendChild(child: any) {
      node.children.push(child);
      return child;
    },
    setAttribute(k: string, v: string) {
      node.attrs[k] = v;
    },
    addEventListener(type: string, fn: () => void) {
      node.listeners[type] = fn;
    },
  };
  return node;
}

const find = (node: any, pred: (n: any) => boolean): any => (pred(node) ? node : node.children?.map((c: any) => find(c, pred)).find(Boolean));

let reducedMotion = false;
let saveData = false;
let layout: LayoutDefinition;

beforeEach(async () => {
  vi.resetModules();
  reducedMotion = false;
  saveData = false;
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reducedMotion }) });
  vi.stubGlobal("navigator", { connection: { get saveData() { return saveData; } } });
  vi.stubGlobal("document", { createElement: el });
  await import("../layouts/floating-bubble");
  layout = (window as any).__vrLayouts["floating-bubble"];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const video: TestimonialItem = { id: "t1", videoUrl: "https://cdn.test/a.mp4", platform: "mp4", thumbnailUrl: "https://cdn.test/a.jpg", customerName: "Sarah" };
const review: ReviewItem = { id: "r1", provider: "google", authorName: "James", rating: 5, text: "Great", reviewDate: null };

function render(over: Partial<LayoutContext> = {}) {
  const ctx = {
    root: el("div"),
    testimonials: [video],
    reviews: [],
    quote: () => ({ text: null, isTranslated: false }),
    openVideo: vi.fn(),
    openReview: vi.fn(),
    track: vi.fn(),
    dismiss: vi.fn(),
    autoplay: true,
    ...over,
  } as LayoutContext;
  layout.render(ctx);
  return ctx;
}

describe("floating bubble", () => {
  it("is a floating layout", () => {
    expect(layout.inline).toBe(false);
  });

  it("loops the video muted, and opens the player (tracked) when clicked", () => {
    const ctx = render();
    const media = find(ctx.root, (n) => n.tag === "video");
    expect(media).toMatchObject({ src: video.videoUrl, muted: true, loop: true, playsInline: true, poster: video.thumbnailUrl });
    find(ctx.root, (n) => n.className === "vr-bubble-open").listeners.click();
    expect(ctx.track).toHaveBeenCalledWith("click", "t1");
    expect(ctx.openVideo).toHaveBeenCalledWith(0);
  });

  it.each([
    ["the owner turned previews off", () => ({ autoplay: false })],
    ["the visitor prefers reduced motion", () => ((reducedMotion = true), {})],
    ["the visitor asked to save data", () => ((saveData = true), {})],
    ["the video is on YouTube", () => ({ testimonials: [{ ...video, platform: "youtube" }] })],
  ])("shows the still poster, downloading no video, when %s", (_why, setup) => {
    const ctx = render(setup() as Partial<LayoutContext>);
    expect(find(ctx.root, (n) => n.tag === "video")).toBeUndefined();
    expect(find(ctx.root, (n) => n.tag === "img").src).toBe(video.thumbnailUrl);
  });

  it("shows the rating and opens the review when there are only reviews", () => {
    const ctx = render({ testimonials: [], reviews: [review] });
    expect(find(ctx.root, (n) => n.textContent === "★ 5")).toBeTruthy();
    find(ctx.root, (n) => n.className === "vr-bubble-open").listeners.click();
    expect(ctx.openReview).toHaveBeenCalledWith(review);
  });

  it("writes the name as text and can be dismissed", () => {
    const ctx = render({ testimonials: [{ ...video, customerName: "<img src=x onerror=alert(1)>" }] });
    expect(find(ctx.root, (n) => n.className === "vr-bubble-label").textContent).toBe("<img src=x onerror=alert(1)>");
    find(ctx.root, (n) => n.className === "vr-bubble-close").listeners.click();
    expect(ctx.dismiss).toHaveBeenCalled();
  });
});
