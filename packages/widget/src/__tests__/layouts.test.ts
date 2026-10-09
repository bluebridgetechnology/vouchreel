import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VouchreelWidget } from "../widget";
import { loadLayout } from "../layout-loader";
import { defineLayout, type LayoutContext, type LayoutDefinition } from "../layout-api";
import type { TestimonialItem } from "../matcher";

/** Just enough DOM for the core (package tests run in node). */
function el(tag: string): any {
  const classes = new Set<string>();
  const node: any = {
    tag,
    children: [] as any[],
    style: { setProperty: vi.fn() },
    attrs: {} as Record<string, string>,
    textContent: "",
    innerHTML: "",
    get className() {
      return Array.from(classes).join(" ");
    },
    set className(v: string) {
      classes.clear();
      v.split(" ").filter(Boolean).forEach((c) => classes.add(c));
    },
    classList: {
      add: (...c: string[]) => c.forEach((x) => classes.add(x)),
      remove: (...c: string[]) => c.forEach((x) => classes.delete(x)),
      contains: (c: string) => classes.has(c),
    },
    appendChild(child: any) {
      node.children.push(child);
      return child;
    },
    setAttribute(k: string, v: string) {
      node.attrs[k] = v;
    },
    addEventListener: vi.fn(),
    focus: vi.fn(),
    attachShadow: () => el("shadow-root"),
    querySelector: () => null,
  };
  return node;
}

let head: any;
let body: any;

beforeEach(() => {
  head = el("head");
  body = el("body");
  vi.stubGlobal("window", { location: { href: "https://client.test/", pathname: "/" } });
  vi.stubGlobal("document", {
    createElement: el,
    createTextNode: (t: string) => ({ textContent: t }),
    querySelector: () => null,
    getElementById: () => null,
    addEventListener: vi.fn(),
    documentElement: { lang: "en" },
    head,
    body,
  });
  vi.stubGlobal("getComputedStyle", () => ({ color: "", getPropertyValue: () => "" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loading a layout chunk", () => {
  const src = "https://app.test/widget/emb-1.js";

  it("needs nothing for the floating card, which lives in the core", async () => {
    expect(await loadLayout("floating-card", src)).toBe(true);
    expect(await loadLayout("", src)).toBe(true);
    expect(head.children).toHaveLength(0);
  });

  it("asks for the chunk next to the widget, versioned by build, with the page's nonce", async () => {
    const done = loadLayout("carousel", src, "abc123");
    const script = head.children[0];
    expect(script.src).toBe("https://app.test/widget/layouts/carousel.js?v=test");
    expect(script.nonce).toBe("abc123");
    expect(script.async).toBe(true);
    defineLayout("carousel", { css: "", inline: true, render() {} });
    script.onload();
    expect(await done).toBe(true);
  });

  it("does not ask again for a layout that is already there", async () => {
    defineLayout("masonry", { css: "", inline: true, render() {} });
    expect(await loadLayout("masonry", src)).toBe(true);
    expect(head.children).toHaveLength(0);
  });

  it("refuses names that are not plain layout names (they can come from an experiment's config)", async () => {
    for (const name of ["../../evil", "https://x.test/a", "Carousel", "a/b", "x?y"]) {
      expect(await loadLayout(name, src)).toBe(false);
    }
    expect(head.children).toHaveLength(0);
  });

  it("reports failure when the file is missing or registers nothing", async () => {
    const missing = loadLayout("spotlight", src);
    head.children[0].onerror();
    expect(await missing).toBe(false);

    const empty = loadLayout("grid", src);
    head.children[1].onload();
    expect(await empty).toBe(false);
  });
});

describe("the core draws whichever layout is registered", () => {
  const testimonials = [{ id: "t-1", customerName: "Jane", videoUrl: "https://v.test/a.mp4", quote: "Great" }] as TestimonialItem[];

  it("hands an inline layout the items and the core's actions, with its CSS in the shadow root", () => {
    let seen: LayoutContext | null = null;
    const layout: LayoutDefinition = {
      css: ".vr-test-layout{}",
      inline: true,
      render: (ctx) => {
        seen = ctx;
      },
    };
    defineLayout("test-inline", layout);
    const widget = new VouchreelWidget({ embedKey: "k", config: { template: "test-inline" }, testimonials });
    widget.mount();

    const w = widget as any;
    expect(seen!.testimonials).toEqual(testimonials);
    expect(seen!.root).toBe(w.rootWrapper);
    expect(seen!.quote(testimonials[0]).text).toBe("Great");
    expect(w.shadowRoot.children[0].textContent).toContain(".vr-test-layout{}");
    expect(w.rootWrapper.classList.contains("vr-template-test-inline")).toBe(true);
    expect(w.rootWrapper.className).not.toContain("vr-pos-");
  });

  it("falls back to the floating card when the chunk never arrived", () => {
    const widget = new VouchreelWidget({ embedKey: "k", config: { template: "not-loaded", position: "bottom-left" }, testimonials });
    widget.mount();

    const root = (widget as any).rootWrapper;
    expect(root.classList.contains("vr-template-floating-card")).toBe(true);
    expect(root.classList.contains("vr-pos-bottom-left")).toBe(true);
    expect(root.children[0].className).toBe("vr-collapsed-card");
  });
});

describe("each shipped chunk registers itself", () => {
  it.each([
    ["wall-of-love", true],
    ["carousel", true],
    ["masonry", true],
    ["story-strip", false],
    ["floating-bubble", false],
    ["floating-reel", false],
  ])("%s (inline: %s)", async (name, inline) => {
    await import(`../layouts/${name}.ts`);
    const layout = (window as any).__vrLayouts[name] as LayoutDefinition;
    expect(layout.inline).toBe(inline);
    expect(typeof layout.render).toBe("function");
  });
});
