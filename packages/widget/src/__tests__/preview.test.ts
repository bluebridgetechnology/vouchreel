import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineLayout } from "../layout-api";

/** Minimal DOM for the preview entry (package tests run in node). */
function el(tag: string): any {
  const classes = new Set<string>();
  const attrs: Record<string, string> = {};
  const node: any = {
    tag,
    children: [] as any[],
    style: { setProperty: vi.fn() },
    textContent: "",
    innerHTML: "",
    removed: false,
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
      toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)),
    },
    attrs,
    toggleAttribute: (k: string, on: boolean) => (on ? (attrs[k] = "") : delete attrs[k]),
    appendChild(child: any) {
      node.children.push(child);
      return child;
    },
    setAttribute(k: string, v: string) {
      attrs[k] = v;
    },
    remove() {
      node.removed = true;
    },
    addEventListener: vi.fn(),
    focus: vi.fn(),
    attachShadow: () => el("shadow-root"),
    querySelector: () => null,
  };
  return node;
}

let listeners: ((e: any) => void)[];
let posted: any[];
let body: any;
let slot: any;

beforeEach(() => {
  vi.resetModules();
  listeners = [];
  posted = [];
  body = el("body");
  slot = el("div");
  vi.stubGlobal("window", {
    location: { origin: "https://app.test", href: "https://app.test/widget/preview.html", pathname: "/widget/preview.html" },
    addEventListener: (type: string, fn: (e: any) => void) => type === "message" && listeners.push(fn),
    parent: { postMessage: (m: unknown, origin: string) => posted.push({ m, origin }) },
  });
  vi.stubGlobal("document", {
    createElement: el,
    createTextNode: (t: string) => ({ textContent: t }),
    querySelector: (s: string) => (s === "[data-vouchreel-embed]" && "data-vouchreel-embed" in slot.attrs ? slot : null),
    getElementById: (id: string) => (id === "vr-slot" ? slot : null),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    documentElement: { lang: "en" },
    body,
  });
  vi.stubGlobal("getComputedStyle", () => ({ color: "", getPropertyValue: () => "" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const items = [{ id: "t", customerName: "Jo", videoUrl: "https://v.test/a.mp4", platform: "mp4" }];
const send = (data: unknown, origin = "https://app.test") => listeners.forEach((fn) => fn({ origin, data }));

describe("the editor preview", () => {
  it("tells the dashboard it is ready, addressed to its own origin only", async () => {
    await import("../preview");
    expect(posted).toEqual([{ m: { type: "vouchreel:preview-ready" }, origin: "https://app.test" }]);
  });

  it("draws a floating widget on the page body and keeps the inline slot hidden", async () => {
    await import("../preview");
    send({ type: "vouchreel:preview", config: { template: "floating-card" }, testimonials: items });
    expect(body.children).toHaveLength(1);
    expect("data-vouchreel-embed" in slot.attrs).toBe(false);
    expect(slot.classList.contains("vr-slot-empty")).toBe(true);
  });

  it("puts an inline layout in the page's slot", async () => {
    defineLayout("wall-test", { css: "", inline: true, render() {} });
    await import("../preview");
    send({ type: "vouchreel:preview", config: { template: "wall-test" }, testimonials: items });
    expect(slot.children).toHaveLength(1);
    expect(slot.classList.contains("vr-slot-empty")).toBe(false);
  });

  it("replaces the previous widget on every change instead of stacking them", async () => {
    await import("../preview");
    send({ type: "vouchreel:preview", config: { template: "floating-card" }, testimonials: items });
    send({ type: "vouchreel:preview", config: { template: "floating-card", theme: { mode: "dark" } }, testimonials: items });
    expect(body.children).toHaveLength(2);
    expect(body.children[0].removed).toBe(true);
    expect(body.children[1].removed).toBe(false);
  });

  it("shows the page dark or light as asked", async () => {
    await import("../preview");
    send({ type: "vouchreel:preview", config: {}, testimonials: items, page: { dark: true } });
    expect(body.classList.contains("dark")).toBe(true);
  });

  it("ignores messages from any other origin, and other message types", async () => {
    await import("../preview");
    send({ type: "vouchreel:preview", config: {}, testimonials: items }, "https://evil.test");
    send({ type: "something-else" });
    expect(body.children).toHaveLength(0);
  });
});
