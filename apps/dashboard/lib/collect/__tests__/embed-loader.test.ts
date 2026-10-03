import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(path.join(import.meta.dirname, "../../../public/collect-embed.js"), "utf8");

/** Runs the loader against a minimal fake DOM and returns the created iframe and the message handler. */
function load(attrs: Record<string, string>, src = "https://app.vouchreel.test/collect-embed.js") {
  const iframe = {
    // The real DOM parses cssText into properties; mimic just the height
    style: {
      height: undefined as string | undefined,
      set cssText(value: string) {
        this.height = /height:(\d+px)/.exec(value)?.[1];
      },
    },
    attrs: {} as Record<string, string>,
    contentWindow: {} as object,
    src: "",
    title: "",
    setAttribute(k: string, v: string) {
      this.attrs[k] = v;
    },
  };
  const script = {
    src,
    getAttribute: (k: string) => attrs[k] ?? null,
    nextSibling: null,
    parentNode: { insertBefore: vi.fn() },
  };
  let handler: (e: unknown) => void = () => {};
  const document = { currentScript: script, createElement: () => iframe };
  const window = {
    location: { href: "https://customer.example/page" },
    addEventListener: (_: string, h: typeof handler) => (handler = h),
  };
  new Function("document", "window", "URL", "console", source)(document, window, URL, console);
  return { iframe, script, send: (e: unknown) => handler(e) };
}

describe("collect-embed.js loader", () => {
  it("creates an iframe pointing at the form with camera and microphone delegated", () => {
    const { iframe, script } = load({ "data-form": "abc123" });
    expect(iframe.src).toBe("https://app.vouchreel.test/collect/abc123");
    expect(iframe.attrs.allow).toBe("camera; microphone");
    expect(script.parentNode.insertBefore).toHaveBeenCalledWith(iframe, null);
  });

  it("encodes the slug", () => {
    expect(load({ "data-form": "a/b c" }).iframe.src).toBe("https://app.vouchreel.test/collect/a%2Fb%20c");
  });

  it("does nothing without data-form", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { script } = load({});
    expect(script.parentNode.insertBefore).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("resizes only for messages from its own iframe and origin", () => {
    const { iframe, send } = load({ "data-form": "abc" });
    const msg = { type: "vouchreel:collect-resize", height: 900 };

    send({ origin: "https://evil.test", source: iframe.contentWindow, data: msg });
    expect(iframe.style.height).toBe("720px");

    send({ origin: "https://app.vouchreel.test", source: {}, data: msg });
    expect(iframe.style.height).toBe("720px");

    send({ origin: "https://app.vouchreel.test", source: iframe.contentWindow, data: msg });
    expect(iframe.style.height).toBe("900px");
  });

  it("clamps absurd heights and ignores malformed messages", () => {
    const { iframe, send } = load({ "data-form": "abc" });
    const ok = { origin: "https://app.vouchreel.test", source: iframe.contentWindow };
    send({ ...ok, data: { type: "vouchreel:collect-resize", height: 999999 } });
    expect(iframe.style.height).toBe("5000px");
    send({ ...ok, data: { type: "vouchreel:collect-resize", height: "tall" } });
    send({ ...ok, data: null });
    expect(iframe.style.height).toBe("5000px");
  });
});
