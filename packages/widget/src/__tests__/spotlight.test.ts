import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutContext, LayoutDefinition } from "../layout-api";
import type { ReviewItem, TestimonialItem } from "../matcher";

/** Just enough DOM to render a layout (package tests run in node). */
function el(tag: string): any {
  const classes = new Set<string>();
  const node: any = {
    tag,
    isConnected: true,
    children: [] as any[],
    attrs: {} as Record<string, string>,
    listeners: {} as Record<string, ((e?: any) => void)[]>,
    _text: "",
    get className() {
      return Array.from(classes).join(" ");
    },
    set className(v: string) {
      classes.clear();
      v.split(" ").filter(Boolean).forEach((c) => classes.add(c));
    },
    get textContent() {
      return node._text;
    },
    set textContent(v: string) {
      node._text = v;
      if (v === "") node.children = [];
    },
    set innerHTML(v: string) {
      node._html = v;
    },
    appendChild(child: any) {
      node.children.push(child);
      return child;
    },
    setAttribute(k: string, v: string) {
      node.attrs[k] = v;
    },
    addEventListener(type: string, fn: (e?: any) => void) {
      (node.listeners[type] ||= []).push(fn);
    },
  };
  return node;
}

const all = (node: any, pred: (n: any) => boolean): any[] => [...(pred(node) ? [node] : []), ...(node.children || []).flatMap((c: any) => all(c, pred))];
const byClass = (root: any, cls: string) => all(root, (n) => n.className.split(" ").includes(cls));
const fire = (node: any, type: string, e: any = {}) => node.listeners[type]?.forEach((fn: any) => fn(e));
const text = (root: any) => all(root, (n) => n._text).map((n) => n._text).join(" | ");

let layout: LayoutDefinition;
let reducedMotion = false;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  reducedMotion = false;
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reducedMotion }) });
  vi.stubGlobal("document", { createElement: el });
  await import("../layouts/spotlight");
  layout = (window as any).__vrLayouts.spotlight;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const video = (n: number): TestimonialItem => ({ id: `t${n}`, videoUrl: `https://cdn.test/${n}.mp4`, platform: "mp4", customerName: `Person ${n}`, customerCompany: `Co ${n}`, quote: `Quote ${n}`, thumbnailUrl: `https://cdn.test/${n}.jpg` });
const review: ReviewItem = { id: "r1", provider: "trustpilot", authorName: "James", rating: 4, text: "Solid", reviewDate: null };

function render(over: Partial<LayoutContext> = {}) {
  const ctx = {
    root: el("div"),
    testimonials: [video(1), video(2), video(3)],
    reviews: [],
    quote: (i: TestimonialItem) => ({ text: i.quote || null, isTranslated: false }),
    openVideo: vi.fn(),
    openReview: vi.fn(),
    track: vi.fn(),
    ...over,
  } as LayoutContext;
  layout.render(ctx);
  return ctx;
}
const dots = (ctx: LayoutContext) => byClass(ctx.root, "vr-spot-dot");

describe("spotlight", () => {
  it("is an inline layout showing the first testimonial large: poster, quote, name and company", () => {
    expect(layout.inline).toBe(true);
    const ctx = render();
    expect(all(ctx.root, (n) => n.tag === "video")).toHaveLength(0); // a picture, not a download
    expect(all(byClass(ctx.root, "vr-spot-media")[0], (n) => n.tag === "img")[0].src).toBe("https://cdn.test/1.jpg");
    expect(text(ctx.root)).toContain('"Quote 1"');
    expect(text(ctx.root)).toContain("Person 1");
    expect(text(ctx.root)).toContain("Co 1");
    expect(dots(ctx).map((d) => d.attrs["aria-pressed"])).toEqual(["true", "false", "false"]);
  });

  it("the picture opens the widget's player for that video, tracked", () => {
    const ctx = render();
    fire(dots(ctx)[1], "click");
    fire(byClass(ctx.root, "vr-spot-media")[0], "click");
    expect(ctx.track).toHaveBeenCalledWith("click", "t2");
    expect(ctx.openVideo).toHaveBeenCalledWith(1);
  });

  it("a thumbnail switches the featured testimonial", () => {
    const ctx = render();
    fire(dots(ctx)[2], "click");
    expect(text(ctx.root)).toContain('"Quote 3"');
    expect(text(ctx.root)).not.toContain("Quote 1");
    expect(dots(ctx).map((d) => d.attrs["aria-pressed"])).toEqual(["false", "false", "true"]);
  });

  it("reviews are slides too: text, stars and source, with a link to the full review", () => {
    const ctx = render({ testimonials: [video(1)], reviews: [review] });
    fire(dots(ctx)[1], "click");
    expect(text(ctx.root)).toContain('"Solid"');
    expect(text(ctx.root)).toContain("★★★★");
    expect(text(ctx.root)).toContain("Trustpilot");
    fire(byClass(ctx.root, "vr-spot-more")[0], "click");
    expect(ctx.openReview).toHaveBeenCalledWith(review);
  });

  it("no thumbnails for a single slide, nothing for none; at most six slides", () => {
    expect(dots(render({ testimonials: [video(1)] }))).toHaveLength(0);
    expect(render({ testimonials: [], reviews: [] }).root.children).toHaveLength(0);
    expect(dots(render({ testimonials: Array.from({ length: 9 }, (_, i) => video(i)) }))).toHaveLength(6);
  });

  it("moves on by itself when asked, and stops for good once the visitor chooses", () => {
    const ctx = render({ theme: { autoAdvance: 5 } });
    vi.advanceTimersByTime(5000);
    expect(text(ctx.root)).toContain("Quote 2");
    fire(dots(ctx)[0], "click");
    vi.advanceTimersByTime(20000);
    expect(text(ctx.root)).toContain("Quote 1");
  });

  it("pauses while the visitor hovers, and never moves for reduced motion or without a setting", () => {
    const ctx = render({ theme: { autoAdvance: 5 } });
    const wrap = ctx.root.children[0];
    fire(wrap, "mouseenter");
    vi.advanceTimersByTime(20000);
    expect(text(ctx.root)).toContain("Quote 1");
    fire(wrap, "mouseleave");
    vi.advanceTimersByTime(5000);
    expect(text(ctx.root)).toContain("Quote 2");

    reducedMotion = true;
    const calm = render({ theme: { autoAdvance: 5 } });
    vi.advanceTimersByTime(20000);
    expect(text(calm.root)).toContain("Quote 1");
    expect(text(render().root)).toContain("Quote 1");
  });

  it("writes names as text", () => {
    const ctx = render({ testimonials: [{ ...video(1), customerName: "<img src=x onerror=alert(1)>" }] });
    expect(byClass(ctx.root, "vr-spot-name")[0]._text).toBe("<img src=x onerror=alert(1)>");
    // The fixed play icon is the only markup; nothing from the visitor's words
    expect(all(ctx.root, (n) => Boolean(n._html)).map((n) => n.className)).toEqual(["vr-play-badge"]);

  });
});
