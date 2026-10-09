import { describe, expect, it, vi } from "vitest";
import { describeInspection, inspectHtml } from "../inspect";
import { fetchPage, MAX_PAGE_BYTES, normalizeUrlInput, runInstallCheck } from "../check";
import { UnsafeUrlError } from "@/lib/security/ssrf";

const KEY = "emb-key-1";
const WIDGET = "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const script = (key = KEY) => `<script async src="https://app.vouchreel.test/widget/${key}.js" data-key="${key}"></script>`;
const html = (body: string, head = "") => `<!doctype html><html><head><title>x</title>${head}</head><body>${body}</body></html>`;

describe("reading a page for the script and a widget's spot", () => {
  it("finds this space's script by its address or its data-key, in any attribute order and quote style", () => {
    expect(inspectHtml(html("", script()), { embedKey: KEY }).scriptFound).toBe(true);
    expect(inspectHtml(html(`<script src='/widget/${KEY}.js'></script>`), { embedKey: KEY }).scriptFound).toBe(true);
    expect(inspectHtml(html(`<script data-key="${KEY}" async src="https://cdn.example/widget/vouchreel-widget.js"></script>`), { embedKey: KEY }).scriptFound).toBe(true);
    expect(inspectHtml(html(`<SCRIPT ASYNC SRC=https://app.test/widget/${KEY}.js?v=2></SCRIPT>`), { embedKey: KEY }).scriptFound).toBe(true);
  });

  it("does not take a similar key, or text that merely mentions it, for the script", () => {
    expect(inspectHtml(html(script("emb-key-10")), { embedKey: KEY }).scriptFound).toBe(false);
    expect(inspectHtml(html(`<p>use /widget/${KEY}.js on your site</p>`), { embedKey: KEY }).scriptFound).toBe(false);
    expect(inspectHtml(html(`<script src="https://other.test/analytics.js" data-key="${KEY}x"></script>`), { embedKey: KEY }).scriptFound).toBe(false);
  });

  it("notices a Vouchreel script for a different space (a snippet pasted from somewhere else)", () => {
    const page = inspectHtml(html("", script("someone-elses")), { embedKey: KEY });
    expect(page).toMatchObject({ scriptFound: false, otherSpaceScript: true });
    // ...but not when this space's script is there too
    expect(inspectHtml(html("", script("someone-elses") + script()), { embedKey: KEY })).toMatchObject({ scriptFound: true, otherSpaceScript: false });
  });

  it("finds an inline widget's own spot, and tells it from the older shared one", () => {
    const input = { embedKey: KEY, widgetId: WIDGET, inline: true };
    expect(inspectHtml(html(`<div data-vouchreel-widget="${WIDGET}"></div>`, script()), input)).toMatchObject({ spotFound: true });
    expect(inspectHtml(html(`<div data-vouchreel-widget='${WIDGET}' class="x"></div>`), input).spotFound).toBe(true);
    expect(inspectHtml(html(`<div data-vouchreel-widget="another-id"></div>`), input).spotFound).toBe(false);
    expect(inspectHtml(html(`<div data-vouchreel-embed></div>`), input)).toMatchObject({ spotFound: false, legacySpotFound: true });
    expect(inspectHtml(html(`<div id="vouchreel-embed"></div>`), input).legacySpotFound).toBe(true);
  });

  it("asks about a spot only for a widget that sits in the page", () => {
    expect(inspectHtml(html("", script()), { embedKey: KEY, widgetId: WIDGET, inline: false })).toMatchObject({ spotFound: null, legacySpotFound: null });
    expect(inspectHtml(html("", script()), { embedKey: KEY })).toMatchObject({ spotFound: null });
  });

  it("notices a tag manager, which can add the script after the HTML is sent", () => {
    expect(inspectHtml(html("", `<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-1"></script>`), { embedKey: KEY }).tagManager).toBe(true);
    expect(inspectHtml(html("", script()), { embedKey: KEY }).tagManager).toBe(false);
  });

  it("reads a large messy page without trouble", () => {
    const noisy = `<div>${"<script>var a = '</scr' + 'ipt>';</script>".repeat(2000)}</div>` + script();
    expect(inspectHtml(html(noisy), { embedKey: KEY }).scriptFound).toBe(true);
  });
});

describe("what the owner is told", () => {
  const say = (page: ReturnType<typeof inspectHtml>, input: Parameters<typeof describeInspection>[1]) => describeInspection(page, input).map((l) => `${l.ok}:${l.text}`);

  it("script and spot both there: two good lines", () => {
    const input = { embedKey: KEY, widgetId: WIDGET, inline: true };
    const lines = describeInspection(inspectHtml(html(`<div data-vouchreel-widget="${WIDGET}"></div>`, script()), input), input);
    expect(lines).toEqual([
      { ok: true, text: "The Vouchreel script is on this page." },
      { ok: true, text: "This widget's spot is on the page." },
    ]);
  });

  it("a floating widget needs only the script", () => {
    const input = { embedKey: KEY, widgetId: WIDGET, inline: false };
    expect(describeInspection(inspectHtml(html("", script()), input), input)).toEqual([{ ok: true, text: "The Vouchreel script is on this page." }]);
  });

  it("no script: says so, and that a script added by JavaScript cannot be seen from here", () => {
    const lines = say(inspectHtml(html("<p>hi</p>"), { embedKey: KEY }), { embedKey: KEY });
    expect(lines[0]).toBe("false:The Vouchreel script was not found in this page's HTML.");
    expect(lines[1]).toContain("null:If your site adds scripts with JavaScript");
  });

  it("no script but a tag manager: points at it instead", () => {
    const page = inspectHtml(html("", `<script src="https://www.googletagmanager.com/gtm.js?id=GTM-1"></script>`), { embedKey: KEY });
    expect(say(page, { embedKey: KEY })[1]).toContain("The page uses a tag manager");
  });

  it("another space's script: says it is the wrong one", () => {
    expect(say(inspectHtml(html("", script("other")), { embedKey: KEY }), { embedKey: KEY })[0]).toContain("for a different space");
  });

  it("an inline widget with only the shared spot, or none, is told what to do", () => {
    const input = { embedKey: KEY, widgetId: WIDGET, inline: true };
    expect(say(inspectHtml(html(`<div data-vouchreel-embed></div>`, script()), input), input)[1]).toContain("older shared spot");
    expect(say(inspectHtml(html("", script()), input), input)[1]).toContain("its spot was not found");
  });
});

describe("the address typed in", () => {
  it("adds https when there is no scheme, and refuses what cannot be an address", () => {
    expect(normalizeUrlInput("acme.com/pricing")).toBe("https://acme.com/pricing");
    expect(normalizeUrlInput("  http://acme.com  ")).toBe("http://acme.com");
    for (const bad of ["", "   ", "two words.com", "x".repeat(3000)]) expect(normalizeUrlInput(bad)).toBeNull();
  });
});

describe("fetching the page", () => {
  const respond = (body: string, init: ResponseInit & { headers?: Record<string, string> } = {}) =>
    vi.fn(async (_url: string, _init?: RequestInit) => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init }));

  it("returns the HTML of a page that answers", async () => {
    const result = await fetchPage("https://acme.com", respond("<p>hello</p>"));
    expect(result).toEqual({ ok: true, status: 200, html: "<p>hello</p>", truncated: false });
  });

  it("sends a plain request that says who is asking, and gives up after a while", async () => {
    const fetcher = respond("x");
    await fetchPage("https://acme.com", fetcher);
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("VouchreelInstallCheck/1.0");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init).not.toHaveProperty("credentials");
  });

  it("reads only the first megabyte of a huge page", async () => {
    const result = await fetchPage("https://acme.com", respond("a".repeat(MAX_PAGE_BYTES + 5_000)));
    expect(result).toMatchObject({ ok: true, truncated: true });
    expect((result as { html: string }).html.length).toBe(MAX_PAGE_BYTES);
  });

  it("explains a refusal, an error, something that is not a web page, a slow site and an unreachable one", async () => {
    const problem = async (fetcher: Parameters<typeof fetchPage>[1]) => ((await fetchPage("https://acme.com", fetcher)) as { problem: string }).problem;
    expect(await problem(respond("", { status: 403 }))).toContain("would not let us in");
    expect(await problem(respond("", { status: 404 }))).toBe("The page answered with an error (404).");
    expect(await problem(respond("{}", { headers: { "content-type": "application/json" } }))).toBe("That address is not a web page.");
    expect(await problem(vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }))).toBe("The page took too long to answer.");
    expect(await problem(vi.fn(async () => { throw new TypeError("fetch failed"); }))).toContain("could not reach that page");
  });

  it("passes on the safe-fetch refusal of a private or internal address, in its own words", async () => {
    const refusing = vi.fn(async () => { throw new UnsafeUrlError("Internal or private addresses are not allowed."); });
    expect(await fetchPage("http://127.0.0.1/", refusing)).toEqual({ ok: false, problem: "Internal or private addresses are not allowed." });
  });
});

describe("a whole check", () => {
  const page = (body: string) => vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": "text/html" } }));

  it("fetches, reads and describes", async () => {
    const result = await runInstallCheck("acme.com", { embedKey: KEY }, page(html("", script())));
    expect(result).toMatchObject({ reachable: true, page: { scriptFound: true } });
    expect(result.lines).toEqual([{ ok: true, text: "The Vouchreel script is on this page." }]);
  });

  it("says when the page could not be checked, and never returns the page itself", async () => {
    expect(await runInstallCheck("two words", { embedKey: KEY })).toMatchObject({ reachable: false, lines: [] });
    const result = await runInstallCheck("acme.com", { embedKey: KEY }, page("<p>secret page content</p>"));
    expect(JSON.stringify(result)).not.toContain("secret page content");
  });

  it("adds a note when only part of a very large page was read and the script was not in it", async () => {
    const huge = page("a".repeat(MAX_PAGE_BYTES + 10));
    const result = await runInstallCheck("acme.com", { embedKey: KEY }, huge);
    expect(result.lines.at(-1)?.text).toContain("read only the first part");
  });
});
