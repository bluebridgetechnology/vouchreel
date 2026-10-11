import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutContext, LayoutDefinition } from "../layout-api";
import type { ReviewItem, TestimonialItem } from "../matcher";

/** Just enough DOM to render a layout (package tests run in node). */
function el(tag: string): any {
  const classes = new Set<string>();
  const node: any = {
    tag,
    children: [] as any[],
    attrs: {} as Record<string, string>,
    listeners: {} as Record<string, ((e: any) => void)[]>,
    _text: "",
    get className() {
      return Array.from(classes).join(" ");
    },
    set className(v: string) {
      classes.clear();
      v.split(" ").filter(Boolean).forEach((c) => classes.add(c));
    },
    classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)), contains: (c: string) => classes.has(c) },
    get textContent() {
      return node._text;
    },
    set textContent(v: string) {
      node._text = v;
      if (v === "") node.children = [];
    },
    appendChild(child: any) {
      node.children.push(child);
      return child;
    },
    setAttribute(k: string, v: string) {
      node.attrs[k] = v;
    },
    addEventListener(type: string, fn: (e: any) => void, capture?: boolean) {
      (node.listeners[capture ? `${type}:capture` : type] ||= []).push(fn);
    },
  };
  return node;
}

const all = (node: any, pred: (n: any) => boolean): any[] => [...(pred(node) ? [node] : []), ...(node.children || []).flatMap((c: any) => all(c, pred))];
const byClass = (root: any, cls: string) => all(root, (n) => n.className.split(" ").includes(cls));
const text = (root: any) => all(root, (n) => n._text).map((n) => n._text).join(" | ");

let layout: LayoutDefinition;
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("document", { createElement: el });
  await import("../layouts/floating-reel");
  layout = (window as any).__vrLayouts["floating-reel"];
});
afterEach(() => vi.unstubAllGlobals());

const video = (n: number): TestimonialItem => ({ id: `t${n}`, videoUrl: `https://cdn.test/${n}.mp4`, platform: "mp4", customerName: `Person ${n}`, quote: `Quote ${n}` });
const review: ReviewItem = { id: "r1", provider: "google", authorName: "James", rating: 4, text: "Solid", reviewDate: null };

function render(over: Partial<LayoutContext> = {}) {
  const ctx = {
    root: el("div"),
    testimonials: [video(1), video(2)],
    reviews: [],
    quote: (i: TestimonialItem) => ({ text: i.quote || null, isTranslated: false }),
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
const fire = (node: any, type: string, e: any = {}) => node.listeners[type]?.forEach((fn: any) => fn(e));
const stage = (ctx: LayoutContext) => byClass(ctx.root, "vr-reel-stage")[0];
const video0 = (ctx: LayoutContext) => all(ctx.root, (n) => n.tag === "video")[0];

describe("floating reel", () => {
  it("is a floating layout that shows the first video muted, with its name and quote", () => {
    expect(layout.inline).toBe(false);
    const ctx = render();
    expect(video0(ctx)).toMatchObject({ src: "https://cdn.test/1.mp4", muted: true, loop: true });
    expect(text(ctx.root)).toContain("Person 1");
    expect(text(ctx.root)).toContain('"Quote 1"');
    expect(byClass(ctx.root, "vr-reel-bar-on")).toHaveLength(1);
  });

  it("the arrows move through the slides, wrapping round, with one video on the page at a time", () => {
    const ctx = render();
    const [prev, next] = [byClass(ctx.root, "vr-reel-prev")[0], byClass(ctx.root, "vr-reel-next")[0]];
    fire(next, "click");
    expect(video0(ctx).src).toBe("https://cdn.test/2.mp4");
    expect(all(ctx.root, (n) => n.tag === "video")).toHaveLength(1);
    fire(next, "click");
    expect(video0(ctx).src).toBe("https://cdn.test/1.mp4");
    fire(prev, "click");
    expect(video0(ctx).src).toBe("https://cdn.test/2.mp4");
  });

  it("a swipe moves on and is not also a tap; a tap opens the player for the current slide (tracked)", () => {
    const ctx = render();
    const s = stage(ctx);
    fire(s, "pointerdown", { clientX: 200 });
    fire(s, "pointerup", { clientX: 120 }); // dragged left
    const stop = vi.fn();
    fire(s, "click:capture", { stopImmediatePropagation: stop });
    expect(stop).toHaveBeenCalled();
    expect(video0(ctx).src).toBe("https://cdn.test/2.mp4");

    fire(s, "pointerdown", { clientX: 100 });
    fire(s, "pointerup", { clientX: 103 }); // a tap
    const noStop = vi.fn();
    fire(s, "click:capture", { stopImmediatePropagation: noStop });
    expect(noStop).not.toHaveBeenCalled();
    fire(s, "click");
    expect(ctx.track).toHaveBeenCalledWith("click", "t2");
    expect(ctx.openVideo).toHaveBeenCalledWith(1);
  });

  it("reviews follow the videos as text slides that open the review", () => {
    const ctx = render({ testimonials: [video(1)], reviews: [review] });
    fire(byClass(ctx.root, "vr-reel-next")[0], "click");
    expect(all(ctx.root, (n) => n.tag === "video")).toHaveLength(0);
    expect(text(ctx.root)).toContain('"Solid"');
    expect(text(ctx.root)).toContain("★★★★");
    fire(stage(ctx), "click");
    expect(ctx.openReview).toHaveBeenCalledWith(review);
  });

  it("shows at most six slides, and no arrows for a single one", () => {
    expect(byClass(render({ testimonials: Array.from({ length: 9 }, (_, i) => video(i)) }).root, "vr-reel-bar")).toHaveLength(6);
    expect(byClass(render({ testimonials: [video(1)] }).root, "vr-reel-next")).toHaveLength(0);
  });

  it("draws nothing without anything to show, and writes names as text", () => {
    const empty = render({ testimonials: [], reviews: [] });
    expect(empty.root.children).toHaveLength(0);
    const hostile = render({ testimonials: [{ ...video(1), customerName: "<img src=x onerror=alert(1)>" }] });
    expect(text(hostile.root)).toContain("<img src=x onerror=alert(1)>");
    fire(byClass(hostile.root, "vr-reel-close")[0], "click");
    expect(hostile.dismiss).toHaveBeenCalled();
  });

  it("uses the still poster, downloading no video, when previews are off", () => {
    const ctx = render({ autoplay: false, testimonials: [{ ...video(1), thumbnailUrl: "https://cdn.test/1.jpg" }] });
    expect(all(ctx.root, (n) => n.tag === "video")).toHaveLength(0);
    expect(all(ctx.root, (n) => n.tag === "img")[0].src).toBe("https://cdn.test/1.jpg");
  });
});
