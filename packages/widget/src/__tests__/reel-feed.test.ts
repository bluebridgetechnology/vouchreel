import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutContext, LayoutDefinition } from "../layout-api";
import type { ReviewItem, TestimonialItem } from "../matcher";

/** Just enough DOM to render a layout and its overlay (package tests run in node). */
function el(tag: string): any {
  const classes = new Set<string>();
  const node: any = {
    tag,
    parent: null as any,
    children: [] as any[],
    attrs: {} as Record<string, string>,
    listeners: {} as Record<string, ((e: any) => void)[]>,
    style: {},
    _text: "",
    focused: false,
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
      child.parent = node;
      node.children.push(child);
      return child;
    },
    remove() {
      if (node.parent) node.parent.children = node.parent.children.filter((c: any) => c !== node);
      node.parent = null;
    },
    setAttribute(k: string, v: string) {
      node.attrs[k] = v;
    },
    addEventListener(type: string, fn: (e: any) => void) {
      (node.listeners[type] ||= []).push(fn);
    },
    focus() {
      node.focused = true;
    },
    getRootNode: () => ({ activeElement: null }),
    querySelectorAll: (sel: string) => all(node, (n) => sel.split(",").some((s) => s.trim() === n.tag)),
  };
  return node;
}

const all = (node: any, pred: (n: any) => boolean): any[] => [...(pred(node) ? [node] : []), ...(node.children || []).flatMap((c: any) => all(c, pred))];
const byClass = (root: any, cls: string) => all(root, (n) => n.className.split(" ").includes(cls));
const fire = (node: any, type: string, e: any = {}) => node.listeners[type]?.forEach((fn: any) => fn(e));

let layout: LayoutDefinition;
let keydown: ((e: any) => void)[];
let docEl: any;

beforeEach(async () => {
  vi.resetModules();
  keydown = [];
  docEl = { style: { overflow: "" } };
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", {
    createElement: el,
    documentElement: docEl,
    addEventListener: (type: string, fn: (e: any) => void) => type === "keydown" && keydown.push(fn),
    removeEventListener: (type: string, fn: (e: any) => void) => type === "keydown" && (keydown = keydown.filter((f) => f !== fn)),
  });
  await import("../layouts/reel-feed");
  layout = (window as any).__vrLayouts["reel-feed"];
});
afterEach(() => vi.unstubAllGlobals());

const mp4 = (n: number): TestimonialItem => ({ id: `t${n}`, videoUrl: `https://cdn.test/${n}.mp4`, platform: "mp4", customerName: `Person ${n}`, quote: `Quote ${n}`, thumbnailUrl: `https://cdn.test/${n}.jpg` });
const youtube: TestimonialItem = { id: "yt", videoUrl: "https://youtu.be/x", platform: "youtube", customerName: "Yuri" };
const review: ReviewItem = { id: "r1", provider: "google", authorName: "James", rating: 5, text: "Great", reviewDate: null };

function render(over: Partial<LayoutContext> = {}) {
  const ctx = {
    root: el("div"),
    testimonials: [mp4(1), mp4(2), mp4(3)],
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
const tiles = (ctx: LayoutContext) => byClass(ctx.root, "vr-feed-tile");
const overlay = (ctx: LayoutContext) => byClass(ctx.root, "vr-feed-overlay")[0];
const playing = (ctx: LayoutContext) => byClass(overlay(ctx), "vr-feed-video")[0];

describe("reel feed", () => {
  it("is an inline layout with a tile per video and pictures, not playing videos", () => {
    expect(layout.inline).toBe(true);
    const ctx = render();
    expect(tiles(ctx)).toHaveLength(3);
    expect(all(ctx.root, (n) => n.tag === "video")).toHaveLength(0);
  });

  it("a tile with no poster shows the video's first frame (metadata only), never a playing video", () => {
    const ctx = render({ testimonials: [{ ...mp4(1), thumbnailUrl: null }] });
    const frame = all(ctx.root, (n) => n.tag === "video")[0];
    expect(frame).toMatchObject({ src: "https://cdn.test/1.mp4#t=0.5", preload: "metadata", muted: true });
    expect(frame.autoplay).toBeUndefined();
  });

  it("opening an uploaded video starts the full-screen player on it, tracked", () => {
    const ctx = render();
    fire(tiles(ctx)[1], "click");
    expect(ctx.track).toHaveBeenCalledWith("click", "t2");
    expect(playing(ctx)).toMatchObject({ src: "https://cdn.test/2.mp4", autoplay: true, playsInline: true, controls: true });
    expect(overlay(ctx).attrs).toMatchObject({ role: "dialog", "aria-modal": "true" });
    expect(docEl.style.overflow).toBe("hidden"); // the page behind does not scroll
    expect(ctx.openVideo).not.toHaveBeenCalled();
  });

  it("counts a play when the video starts", () => {
    const ctx = render();
    fire(tiles(ctx)[0], "click");
    fire(playing(ctx), "play");
    expect(ctx.track).toHaveBeenCalledWith("play", "t1");
  });

  it("swipes, arrow keys and the buttons move through the videos, wrapping; the end of one starts the next", () => {
    const ctx = render();
    fire(tiles(ctx)[0], "click");
    const stage = byClass(overlay(ctx), "vr-feed-stage")[0];
    fire(stage, "pointerdown", { clientX: 100, clientY: 400 });
    fire(stage, "pointerup", { clientX: 105, clientY: 300 }); // up
    expect(playing(ctx).src).toBe("https://cdn.test/2.mp4");
    fire(stage, "pointerdown", { clientX: 100, clientY: 300 });
    fire(stage, "pointerup", { clientX: 260, clientY: 310 }); // sideways: ignored
    expect(playing(ctx).src).toBe("https://cdn.test/2.mp4");
    keydown.forEach((fn) => fn({ key: "ArrowDown" }));
    expect(playing(ctx).src).toBe("https://cdn.test/3.mp4");
    fire(byClass(overlay(ctx), "vr-feed-down")[0], "click");
    expect(playing(ctx).src).toBe("https://cdn.test/1.mp4");
    fire(byClass(overlay(ctx), "vr-feed-up")[0], "click");
    expect(playing(ctx).src).toBe("https://cdn.test/3.mp4");
    fire(playing(ctx), "ended");
    expect(playing(ctx).src).toBe("https://cdn.test/1.mp4");
  });

  it("Escape and the close button close it, give the page its scroll back, and return focus to the tile", () => {
    const ctx = render();
    docEl.style.overflow = "auto";
    fire(tiles(ctx)[0], "click");
    const stop = vi.fn();
    keydown.forEach((fn) => fn({ key: "Escape", stopPropagation: stop }));
    expect(overlay(ctx)).toBeUndefined();
    expect(stop).toHaveBeenCalled();
    expect(docEl.style.overflow).toBe("auto");
    expect(tiles(ctx)[0].focused).toBe(true);
    expect(keydown).toHaveLength(0); // no listener left behind

    fire(tiles(ctx)[1], "click");
    fire(byClass(overlay(ctx), "vr-feed-close")[0], "click");
    expect(overlay(ctx)).toBeUndefined();
  });

  it("YouTube videos and reviews use the widget's own pop-up, which can play them", () => {
    const ctx = render({ testimonials: [mp4(1), youtube], reviews: [review] });
    fire(tiles(ctx)[1], "click");
    expect(ctx.openVideo).toHaveBeenCalledWith(1);
    expect(overlay(ctx)).toBeUndefined();
    fire(tiles(ctx)[2], "click");
    expect(ctx.openReview).toHaveBeenCalledWith(review);
    // The full-screen player only cycles through the uploaded videos
    fire(tiles(ctx)[0], "click");
    expect(byClass(overlay(ctx), "vr-feed-up")).toHaveLength(0);
  });

  it("writes names as text, and shows at most twelve tiles", () => {
    const hostile = render({ testimonials: [{ ...mp4(1), customerName: "<img src=x onerror=alert(1)>" }] });
    expect(all(hostile.root, (n) => n._text.includes("<img"))).toHaveLength(1);
    const many = render({ testimonials: Array.from({ length: 20 }, (_, i) => mp4(i)) });
    expect(tiles(many)).toHaveLength(12);
  });
});
