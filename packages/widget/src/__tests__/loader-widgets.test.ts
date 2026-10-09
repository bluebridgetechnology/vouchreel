import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** What each created widget was given, and how many times each was mounted. */
const created = vi.hoisted(() => [] as { options: Record<string, any>; mount: ReturnType<typeof vi.fn> }[]);
const layoutAsks = vi.hoisted(() => [] as string[]);

vi.mock("../widget", () => ({
  VouchreelWidget: class {
    mount = vi.fn();
    constructor(public options: Record<string, any>) {
      created.push({ options, mount: this.mount });
    }
  },
}));
vi.mock("../analytics", () => ({
  AnalyticsTracker: class {
    track = vi.fn();
  },
  getOrCreateSessionId: () => "session-1",
}));
vi.mock("../layout-loader", () => ({
  loadLayout: (name: string) => {
    layoutAsks.push(name);
    return Promise.resolve(true);
  },
}));

import { initLoader } from "../loader";

const testimonial = { id: "t1", videoUrl: "https://cdn.test/1.mp4", platform: "mp4", customerName: "Jo" };
const cfg = (over: Record<string, unknown> = {}) => ({
  template: "floating-card",
  position: "bottom-right",
  theme: { primaryColor: "#cf3d0b", accentColor: "#ffffff", mode: "light", borderRadius: 12 },
  trigger: { type: "delay", value: { seconds: 1 } },
  pagesIncluded: ["*"],
  pagesExcluded: [],
  autoplayPreview: true,
  ...over,
});

let payload: Record<string, any>;
let spots: Record<string, object>;
let session: Record<string, string>;
let local: Record<string, string>;
let path: string;

beforeEach(() => {
  created.length = 0;
  layoutAsks.length = 0;
  spots = {};
  session = {};
  local = {};
  path = "/";
  payload = { spaceId: "s1", config: cfg({ id: "w1" }), testimonials: [testimonial], reviews: [], conversionGoals: [], whiteLabel: {} };
  vi.useFakeTimers();
  class FakeScript {
    src = "https://app.test/widget/emb-key.js";
    nonce = "n1";
    getAttribute = (k: string) => (k === "src" ? this.src : null);
  }
  vi.stubGlobal("HTMLScriptElement", FakeScript);
  const script = new FakeScript();
  vi.stubGlobal("window", { location: { pathname: path, href: "https://client.test/", origin: "https://client.test" } });
  Object.defineProperty(window, "location", { get: () => ({ pathname: path, href: `https://client.test${path}`, origin: "https://client.test" }), configurable: true });
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => session[k] ?? null, setItem: (k: string, v: string) => (session[k] = v) });
  vi.stubGlobal("localStorage", { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v) });
  (window as any).sessionStorage = (globalThis as any).sessionStorage;
  (window as any).localStorage = (globalThis as any).localStorage;
  vi.stubGlobal("document", {
    currentScript: script,
    querySelector: (sel: string) => {
      const m = /^\[data-vouchreel-widget="(.+)"\]$/.exec(sel);
      return m ? spots[m[1]] ?? null : null;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    documentElement: { scrollTop: 0, scrollHeight: 1000, clientHeight: 800, lang: "en" },
    readyState: "complete",
  });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => payload })));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Runs the loader and lets every widget's trigger fire. */
async function run() {
  await initLoader();
  await vi.advanceTimersByTimeAsync(10_000);
}

describe("the embed script with one widget", () => {
  it("shows it exactly as it always did: keyed by the embed key, first in line, no spot of its own", async () => {
    await run();
    expect(created).toHaveLength(1);
    expect(created[0].options).toMatchObject({ embedKey: "emb-key", primary: true, container: null });
    expect(created[0].mount).toHaveBeenCalledTimes(1);
    expect(layoutAsks).toEqual(["floating-card"]);
  });

  it("an older payload with no widget id works the same", async () => {
    payload.config = cfg();
    await run();
    expect(created).toHaveLength(1);
    expect(created[0].options.primary).toBe(true);
    expect(created[0].mount).toHaveBeenCalled();
  });

  it("does nothing when the page is not allowed, or there is nothing to show", async () => {
    payload.config = cfg({ id: "w1", pagesIncluded: ["/pricing"] });
    await run();
    expect(created).toHaveLength(0);
    payload = { ...payload, config: cfg({ id: "w1" }), testimonials: [], reviews: [] };
    await run();
    expect(created).toHaveLength(0);
  });

  it("does nothing when every widget is off (the server sends no config)", async () => {
    payload = { spaceId: "s1", config: null, testimonials: [], reviews: [] };
    await run();
    expect(created).toHaveLength(0);
  });
});

describe("the embed script with several widgets", () => {
  beforeEach(() => {
    payload.widgets = [{ id: "w1" }, { id: "w2", config: cfg({ template: "wall-of-love" }) }, { id: "w3", config: cfg({ template: "floating-bubble" }) }];
  });

  it("makes one widget each: the first from `config`, the others from their own, each with its own key", async () => {
    await run();
    expect(created.map((c) => [c.options.embedKey, c.options.primary, c.options.config.template])).toEqual([
      ["emb-key", true, "floating-card"],
      ["emb-key-w2", false, "wall-of-love"],
      ["emb-key-w3", false, "floating-bubble"],
    ]);
    for (const c of created) expect(c.mount).toHaveBeenCalledTimes(1);
    // They share one set of testimonials and one analytics tracker
    expect(created[1].options.testimonials).toBe(created[0].options.testimonials);
    expect(created[1].options.analytics).toBe(created[0].options.analytics);
  });

  it("puts a widget in the spot the page named for it, by id", async () => {
    const spot = { name: "the wall's spot" };
    spots["w2"] = spot;
    await run();
    expect(created[1].options.container).toBe(spot);
    expect(created[0].options.container).toBeNull();
    expect(created[2].options.container).toBeNull();
  });

  it("an inline widget the page has no spot for is skipped without downloading its layout", async () => {
    payload.widgets[1].inline = true; // the wall of love, with no spot on this page
    await run();
    expect(created.map((c) => c.options.embedKey)).toEqual(["emb-key", "emb-key-w3"]);
    expect(layoutAsks).toEqual(["floating-card", "floating-bubble"]);
    created.length = 0;
    layoutAsks.length = 0;
    spots["w2"] = { name: "its spot" }; // ...and with one
    await run();
    expect(created.map((c) => c.options.embedKey)).toEqual(["emb-key", "emb-key-w2", "emb-key-w3"]);
    expect(layoutAsks).toContain("wall-of-love");
  });

  it("each widget has its own page targeting", async () => {
    payload.widgets[1].config = cfg({ template: "wall-of-love", pagesIncluded: ["/reviews"] });
    payload.widgets[2].config = cfg({ template: "floating-bubble", pagesExcluded: ["/"] });
    path = "/";
    await run();
    expect(created.map((c) => c.options.embedKey)).toEqual(["emb-key"]);
    created.length = 0;
    path = "/reviews";
    await run();
    expect(created.map((c) => c.options.embedKey)).toEqual(["emb-key", "emb-key-w2", "emb-key-w3"]);
  });

  it("closing one widget leaves the others (dismissal is per widget)", async () => {
    session["vouchreel_dismissed_emb-key-w2"] = "true";
    await run();
    expect(created.map((c) => c.options.embedKey)).toEqual(["emb-key", "emb-key-w3"]);
    created.length = 0;
    session["vouchreel_dismissed_emb-key"] = "true";
    await run();
    expect(created.map((c) => c.options.embedKey)).toEqual(["emb-key-w3"]);
    expect(created[0].options.primary).toBe(false);
  });

  it("each widget has its own trigger, and a visitor's page-view count goes up once per page", async () => {
    payload.config = cfg({ id: "w1", trigger: { type: "pageview-count", value: { count: 1 } } });
    payload.widgets[1].config = cfg({ template: "wall-of-love", trigger: { type: "pageview-count", value: { count: 2 } } });
    payload.widgets[2].config = cfg({ template: "floating-bubble", trigger: { type: "delay", value: { seconds: 5 } } });
    await run();
    expect(session["vouchreel_pv_count"]).toBe("1");
    expect(created.map((c) => c.mount.mock.calls.length)).toEqual([1, 0, 1]);
  });

  it("asks for each layout's file, and the loader hands every widget its layout", async () => {
    await run();
    expect(layoutAsks).toEqual(["floating-card", "wall-of-love", "floating-bubble"]);
  });

  it("the experiment changes the first widget only", async () => {
    payload.activeExperiment = { id: "exp1", name: "x", type: "template", trafficSplit: [0, 100], variants: [{ id: "a", name: "A", config: { template: "floating-card" } }, { id: "b", name: "B", config: { template: "carousel" } }] };
    await run();
    expect(created[0].options.config.template).toBe("carousel");
    expect(created[1].options.config.template).toBe("wall-of-love");
  });

  it("a malformed extra entry (no config) is skipped, not fatal", async () => {
    payload.widgets = [{ id: "w1" }, { id: "w2" }, { id: "w3", config: cfg({ template: "floating-bubble" }) }];
    await run();
    expect(created.map((c) => c.options.embedKey)).toEqual(["emb-key", "emb-key-w3"]);
  });
});
