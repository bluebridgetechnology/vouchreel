import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutContext } from "../layout-api";
import type { TestimonialItem } from "../matcher";

/** Just enough DOM to build a tile (package tests run in node). */
function el(tag: string): any {
  const node: any = {
    tag,
    children: [] as any[],
    attrs: {} as Record<string, string>,
    listeners: {} as Record<string, (() => void)[]>,
    className: "",
    _text: "",
    removed: false,
    get textContent() {
      return node._text;
    },
    set textContent(v: string) {
      node._text = v;
    },
    set innerHTML(v: string) {
      node.html = v;
    },
    appendChild(child: any) {
      node.children.push(child);
      return child;
    },
    remove() {
      node.removed = true;
    },
    setAttribute(k: string, v: string) {
      node.attrs[k] = v;
    },
    addEventListener(type: string, fn: () => void) {
      (node.listeners[type] ||= []).push(fn);
    },
  };
  return node;
}

const all = (node: any, pred: (n: any) => boolean): any[] => [...(pred(node) ? [node] : []), ...(node.children || []).flatMap((c: any) => all(c, pred))];
const byClass = (root: any, cls: string) => all(root, (n) => String(n.className).split(" ").includes(cls));
const text = (root: any) => all(root, (n) => n._text).map((n) => n._text).join(" | ");

let videoTile: (ctx: LayoutContext, item: TestimonialItem, idx: number) => any;

beforeEach(async () => {
  vi.stubGlobal("document", { createElement: el });
  videoTile = (await import("../layouts/tile")).videoTile;
});
afterEach(() => vi.unstubAllGlobals());

const ctx = { quote: (i: TestimonialItem) => ({ text: i.quote || null, isTranslated: false }), track: vi.fn(), openVideo: vi.fn() } as unknown as LayoutContext;
const item = (over: Partial<TestimonialItem> = {}): TestimonialItem => ({ id: "t1", videoUrl: "https://v/x.mp4", platform: "mp4", customerName: "Sarah Chen", customerCompany: "Northwind", quote: "We doubled our bookings.", thumbnailUrl: "https://v/x.jpg", durationSeconds: 75, ...over });

describe("the video tile", () => {
  it("is a button that says what it plays, with the poster, a play button, the length and the person's words", () => {
    const tile = videoTile(ctx, item(), 0);
    expect(tile.tag).toBe("button");
    expect(tile.attrs["aria-label"]).toBe("Play video testimonial from Sarah Chen");
    expect(tile.className).toContain("vr-blend-video-card");
    expect(byClass(tile, "vr-tile-img")[0]).toMatchObject({ tag: "img", src: "https://v/x.jpg" });
    expect(byClass(tile, "vr-tile-play")[0].attrs["aria-hidden"]).toBe("true");
    expect(text(tile)).toContain("1:15");
    expect(text(tile)).toContain('"We doubled our bookings."');
    expect(text(tile)).toContain("Sarah Chen");
    expect(text(tile)).toContain("Northwind");
  });

  it("uses the poster only, never a video loop: a wall of loops would download a video for every tile", () => {
    const tile = videoTile(ctx, item(), 0);
    expect(all(tile, (n) => n.tag === "video")).toHaveLength(0);
  });

  it("without a poster it draws the initial on the brand colour, and without a name says Customer", () => {
    const tile = videoTile(ctx, item({ thumbnailUrl: null }), 0);
    expect(byClass(tile, "vr-media-initial")[0]._text).toBe("S");
    const anon = videoTile(ctx, item({ thumbnailUrl: null, customerName: undefined, customerCompany: undefined }), 0);
    expect(text(anon)).toContain("Customer");
    expect(anon.attrs["aria-label"]).toBe("Play video testimonial from customer");
  });

  it("leaves out the length, the words and the company when there are none", () => {
    const tile = videoTile(ctx, item({ durationSeconds: null, quote: null, customerCompany: undefined }), 0);
    expect(byClass(tile, "vr-tile-time")).toHaveLength(0);
    expect(byClass(tile, "vr-tile-quote")).toHaveLength(0);
    expect(byClass(tile, "vr-tile-co")).toHaveLength(0);
  });

  it("a made video shows its first frames, carries its label, and the tile goes if its file is gone", () => {
    const tile = videoTile(ctx, item({ thumbnailUrl: null, generated: "review", badge: "⭐ Review video" }), 0);
    const frame = byClass(tile, "vr-tile-img")[0];
    expect(frame).toMatchObject({ tag: "video", src: "https://v/x.mp4#t=1", preload: "metadata", muted: true });
    expect(text(tile)).toContain("⭐ Review video");
    expect(tile.removed).toBe(false);
    frame.onerror();
    expect(tile.removed).toBe(true);
  });

  it("says when words were translated", () => {
    const translated = { quote: () => ({ text: "Verdoppelt.", isTranslated: true, lang: "de" }), track: vi.fn(), openVideo: vi.fn() } as unknown as LayoutContext;
    expect(byClass(videoTile(translated, item(), 0), "vr-tile-quote")[0].attrs["data-translated-lang"]).toBe("de");
  });

  it("clicking tracks it and opens that video", () => {
    const c = { ...ctx, track: vi.fn(), openVideo: vi.fn() } as unknown as LayoutContext;
    videoTile(c, item(), 3).listeners.click.forEach((fn: () => void) => fn());
    expect(c.track).toHaveBeenCalledWith("click", "t1");
    expect(c.openVideo).toHaveBeenCalledWith(3);
  });
});
