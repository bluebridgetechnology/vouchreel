import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { LayoutContext, LayoutDefinition } from "../layout-api";
import type { ReviewItem, TestimonialItem } from "../matcher";

/** Just enough DOM to render a layout (package tests run in node). */
function el(tag: string): any {
  const classes = new Set<string>();
  const node: any = {
    tag,
    children: [] as any[],
    attrs: {} as Record<string, string>,
    listeners: {} as Record<string, ((e?: any) => void)[]>,
    styleVars: {} as Record<string, string>,
    style: { setProperty: (k: string, v: string) => (node.styleVars[k] = v) },
    _text: "",
    tabIndex: 0,
    offsetWidth: 0,
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
    },
    appendChild(child: any) {
      node.children.push(child);
      return child;
    },
    setAttribute(k: string, v: string) {
      node.attrs[k] = v;
    },
    getAttribute: (k: string) => node.attrs[k] ?? null,
    addEventListener(type: string, fn: (e?: any) => void) {
      (node.listeners[type] ||= []).push(fn);
    },
  };
  return node;
}

const all = (node: any, pred: (n: any) => boolean): any[] => [...(pred(node) ? [node] : []), ...(node.children || []).flatMap((c: any) => all(c, pred))];
const byClass = (root: any, cls: string) => all(root, (n) => n.className.split(" ").includes(cls));
const fire = (node: any, type: string) => node.listeners[type]?.forEach((fn: any) => fn());
const text = (root: any) => all(root, (n) => n._text).map((n) => n._text).join(" | ");

let layout: LayoutDefinition;
let setWidth = 1000;

beforeEach(async () => {
  vi.resetModules();
  setWidth = 1000;
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      const node = el(tag);
      // The first repeat has a real width once it is on the page
      Object.defineProperty(node, "offsetWidth", { get: () => (node.className === "vr-mq-set" ? setWidth : 0) });
      return node;
    },
  });
  await import("../layouts/marquee");
  layout = (window as any).__vrLayouts.marquee;
});
afterEach(() => vi.unstubAllGlobals());

const video = (n: number): TestimonialItem => ({ id: `t${n}`, videoUrl: `https://cdn.test/${n}.mp4`, platform: "mp4", customerName: `Person ${n}`, quote: `Quote ${n}` });
const review = (n: number): ReviewItem => ({ id: `r${n}`, provider: "google", authorName: `Reviewer ${n}`, rating: 5, text: `Review ${n}`, reviewDate: null });

function render(testimonials: TestimonialItem[], reviews: ReviewItem[] = []) {
  const ctx = { root: el("div"), testimonials, reviews, quote: (i: TestimonialItem) => ({ text: i.quote || null, isTranslated: false }), openVideo: vi.fn(), openReview: vi.fn(), track: vi.fn() } as unknown as LayoutContext;
  layout.render(ctx);
  return ctx;
}
const sets = (ctx: LayoutContext) => all(ctx.root, (n) => n.className.split(" ").includes("vr-mq-set"));
const track = (ctx: LayoutContext) => byClass(ctx.root, "vr-mq-track")[0];

describe("marquee", () => {
  it("is an inline layout; videos and reviews alternate; nothing for no content", () => {
    expect(layout.inline).toBe(true);
    const ctx = render([video(1), video(2)], [review(1), review(2)]);
    const first = sets(ctx)[0];
    expect(first.children.map((c: any) => (c.className.includes("vr-mq-review") ? "review" : "video"))).toEqual(["video", "review", "video", "review"]);
    expect(render([]).root.children).toHaveLength(0);
  });

  it("repeats the strip until it is wider than any screen, and slides by exactly one repeat", () => {
    // One repeat is 1000px. Sliding by a repeat needs the strip to cover 2400px plus that repeat: four of them
    const ctx = render([video(1)]);
    expect(sets(ctx)).toHaveLength(4);
    expect(track(ctx).styleVars["--vr-mq-shift"]).toBe("-25.0000%");
    setWidth = 5000;
    expect(sets(render([video(1)]))).toHaveLength(2); // never fewer than two, or the loop would jump
    expect(track(render([video(1)])).styleVars["--vr-mq-shift"]).toBe("-50.0000%");
  });

  it("scrolls at a readable speed, however long the strip", () => {
    expect(track(render([video(1)])).styleVars["--vr-mq-dur"]).toBe("25s"); // 1000px at 40px/s
    setWidth = 100;
    expect(track(render([video(1)])).styleVars["--vr-mq-dur"]).toBe("12s"); // a floor, so a short strip is not frantic
  });

  it("the repeats are hidden from screen readers and the keyboard, so each card is reachable once", () => {
    const ctx = render([video(1), video(2)], [review(1)]);
    const [real, ...clones] = sets(ctx);
    expect(real.attrs["aria-hidden"]).toBeUndefined();
    expect(all(real, (n) => n.tag === "button").every((b) => b.tabIndex === 0)).toBe(true);
    for (const clone of clones) {
      expect(clone.attrs["aria-hidden"]).toBe("true");
      expect(clone.className).toContain("vr-mq-clone");
      expect(all(clone, (n) => n.tag === "button").every((b) => b.tabIndex === -1)).toBe(true);
    }
  });

  it("a card opens the widget's player or review (a video tracked), also from a repeat", () => {
    const reviews = [review(1)];
    const ctx = render([video(1)], reviews);
    const [real, clone] = sets(ctx);
    fire(real.children[0], "click");
    expect(ctx.track).toHaveBeenCalledWith("click", "t1");
    expect(ctx.openVideo).toHaveBeenCalledWith(0);
    fire(clone.children[1], "click");
    expect(ctx.openReview).toHaveBeenCalledWith(reviews[0]);
  });

  it("has a Pause button that stops the strip and says what it will do next", () => {
    const ctx = render([video(1)]);
    const pause = byClass(ctx.root, "vr-mq-pause")[0];
    const wrap = byClass(ctx.root, "vr-mq")[0];
    expect(pause.textContent).toBe("Pause scrolling");
    fire(pause, "click");
    expect(pause.attrs["aria-pressed"]).toBe("true");
    expect(pause.textContent).toBe("Play scrolling");
    expect(wrap.className).toContain("vr-mq-paused");
    fire(pause, "click");
    expect(wrap.className).not.toContain("vr-mq-paused");
  });

  it("writes names and words as text", () => {
    const ctx = render([{ ...video(1), customerName: "<img src=x onerror=alert(1)>" }]);
    expect(text(ctx.root)).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("marquee stylesheet", () => {
  const css = readFileSync(new URL("../layouts/marquee.css", import.meta.url), "utf8");

  it("stops on hover and focus, and when paused", () => {
    for (const selector of [".vr-mq:hover .vr-mq-track", ".vr-mq:focus-within .vr-mq-track", ".vr-mq-paused .vr-mq-track"]) expect(css).toContain(selector);
    expect(css).toContain("animation-play-state: paused");
  });

  it("does not move at all for visitors who ask for reduced motion, and lets them scroll the row instead", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("animation: none");
    expect(reduced).toContain("overflow-x: auto");
    expect(reduced).toMatch(/\.vr-mq-clone,\s*\.vr-mq-pause\s*\{\s*display: none/);
  });
});
