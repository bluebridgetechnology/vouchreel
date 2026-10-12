import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutContext, LayoutDefinition } from "../layout-api";
import type { ReviewItem } from "../matcher";

/** Just enough DOM to render a layout and its sheet (package tests run in node). */
function el(tag: string): any {
  const classes = new Set<string>();
  const node: any = {
    tag,
    parent: null as any,
    children: [] as any[],
    attrs: {} as Record<string, string>,
    listeners: {} as Record<string, ((e?: any) => void)[]>,
    styleVars: {} as Record<string, string>,
    style: { setProperty: (k: string, v: string) => (node.styleVars[k] = v) },
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
    addEventListener(type: string, fn: (e?: any) => void) {
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
const text = (root: any) => all(root, (n) => n._text).map((n) => n._text).join(" | ");

let layout: LayoutDefinition;
let summarize: (reviews: ReviewItem[]) => { average: number; count: number };
let keydown: ((e: any) => void)[];

beforeEach(async () => {
  vi.resetModules();
  keydown = [];
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", {
    createElement: el,
    addEventListener: (type: string, fn: (e: any) => void) => type === "keydown" && keydown.push(fn),
    removeEventListener: (type: string, fn: (e: any) => void) => type === "keydown" && (keydown = keydown.filter((f) => f !== fn)),
  });
  const mod = await import("../layouts/rating-badge");
  summarize = (mod as any).summarize;
  layout = (window as any).__vrLayouts["rating-badge"];
});
afterEach(() => vi.unstubAllGlobals());

const review = (n: number, rating: number, provider = "google"): ReviewItem => ({ id: `r${n}`, provider, authorName: `Person ${n}`, rating, text: `Review ${n}`, reviewDate: null });

function render(reviews: ReviewItem[], testimonials: any[] = []) {
  const ctx = { root: el("div"), testimonials, reviews, quote: () => ({ text: null, isTranslated: false }), openVideo: vi.fn(), openReview: vi.fn(), track: vi.fn() } as unknown as LayoutContext;
  layout.render(ctx);
  return ctx;
}
const badge = (ctx: LayoutContext) => byClass(ctx.root, "vr-badge")[0];
const sheet = (ctx: LayoutContext) => byClass(ctx.root, "vr-badge-sheet")[0];

describe("rating badge", () => {
  it("is an inline layout", () => {
    expect(layout.inline).toBe(true);
  });

  it("averages only valid ratings, and counts only those", () => {
    expect(summarize([review(1, 5), review(2, 4), review(3, 0), review(4, 9), { ...review(5, 3), rating: NaN }])).toEqual({ average: 4.5, count: 2 });
    expect(summarize([])).toEqual({ average: 0, count: 0 });
  });

  it("shows the average to one decimal and the real count, with the stars filled to it", () => {
    const ctx = render([review(1, 5), review(2, 5), review(3, 4)]);
    expect(text(badge(ctx))).toContain("4.7");
    expect(text(badge(ctx))).toContain("from 3 reviews");
    expect(badge(ctx).attrs["aria-label"]).toBe("Rated 4.7 out of 5 from 3 reviews. Show reviews");
    expect(Number.parseFloat(byClass(ctx.root, "vr-badge-stars")[0].styleVars["--vr-fill"])).toBeCloseTo(93.3, 0);
  });

  it("says 'review' for one, groups thousands, and draws nothing for none", () => {
    expect(text(badge(render([review(1, 5)])))).toContain("from 1 review");
    expect(text(badge(render(Array.from({ length: 1234 }, (_, i) => review(i, 5)))))).toContain("from 1,234 reviews");
    expect(render([]).root.children).toHaveLength(0);
    expect(render([review(1, 0)]).root.children).toHaveLength(0);
  });

  it("with videos but no star ratings it says so and opens the first video, instead of drawing nothing", () => {
    const videos = [{ id: "t1", videoUrl: "v1", platform: "mp4" }, { id: "t2", videoUrl: "v2", platform: "mp4" }];
    const ctx = render([], videos);
    expect(text(badge(ctx))).toContain("Watch 2 customer videos");
    expect(badge(ctx).attrs["aria-label"]).toBe("Watch 2 customer videos");
    fire(badge(ctx), "click");
    expect(ctx.openVideo).toHaveBeenCalledWith(0);
    expect(ctx.track).toHaveBeenCalledWith("click", "t1");
    expect(text(badge(render([], [videos[0]])))).toContain("Watch 1 customer video");
    // Reviews with ratings still win: the score is what the badge is for
    expect(text(badge(render([review(1, 5)], videos)))).toContain("from 1 review");
    // Unrated reviews and no videos is still nothing
    expect(render([review(1, 0)], []).root.children).toHaveLength(0);
  });

  it("names a source only when every review comes from it", () => {
    expect(text(badge(render([review(1, 5), review(2, 4)])))).toContain("on Google");
    expect(text(badge(render([review(1, 5, "trustpilot")])))).toContain("on Trustpilot");
    expect(text(badge(render([review(1, 5, "google"), review(2, 4, "trustpilot")])))).not.toContain(" on ");
  });

  it("clicking opens a sheet of reviews (tracked), focus on the close button, at most eight listed", () => {
    const ctx = render(Array.from({ length: 12 }, (_, i) => review(i, 5)));
    fire(badge(ctx), "click");
    expect(ctx.track).toHaveBeenCalledWith("click");
    expect(sheet(ctx).attrs).toMatchObject({ role: "dialog", "aria-modal": "true" });
    expect(byClass(sheet(ctx), "vr-badge-review")).toHaveLength(8);
    expect(text(sheet(ctx))).toContain("from 12 reviews"); // the count still covers all of them
    expect(byClass(sheet(ctx), "vr-badge-close")[0].focused).toBe(true);
  });

  it("Escape, the close button and the backdrop close it and return focus to the badge", () => {
    const ctx = render([review(1, 5), review(2, 4)]);
    fire(badge(ctx), "click");
    const stop = vi.fn();
    keydown.forEach((fn) => fn({ key: "Escape", stopPropagation: stop }));
    expect(sheet(ctx)).toBeUndefined();
    expect(stop).toHaveBeenCalled();
    expect(badge(ctx).focused).toBe(true);
    expect(keydown).toHaveLength(0);

    fire(badge(ctx), "click");
    fire(byClass(ctx.root, "vr-badge-close")[0], "click");
    expect(sheet(ctx)).toBeUndefined();
    fire(badge(ctx), "click");
    fire(byClass(ctx.root, "vr-badge-backdrop")[0], "click");
    expect(sheet(ctx)).toBeUndefined();
  });

  it("a review in the sheet closes it and opens the full review in the widget's pop-up", () => {
    const reviews = [review(1, 5), review(2, 4)];
    const ctx = render(reviews);
    fire(badge(ctx), "click");
    fire(byClass(sheet(ctx), "vr-badge-review")[1], "click");
    expect(ctx.openReview).toHaveBeenCalledWith(reviews[1]);
    expect(sheet(ctx)).toBeUndefined();
    expect(keydown).toHaveLength(0);
  });

  it("writes reviewers' words as text", () => {
    const ctx = render([{ ...review(1, 5), authorName: "<img src=x onerror=alert(1)>", text: "<b>x</b>" }]);
    fire(badge(ctx), "click");
    expect(text(sheet(ctx))).toContain("<img src=x onerror=alert(1)>");
    expect(all(ctx.root, (n) => Boolean(n._html))).toEqual([]);
  });
});
