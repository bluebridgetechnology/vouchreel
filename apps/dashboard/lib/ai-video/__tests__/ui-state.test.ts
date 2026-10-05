import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ScriptDiff } from "@/components/ai-video/script-diff";
import { diffRemovedWords } from "../trim";
import { pickActiveVideo, reviewScript, shouldPoll, summarizeCredits, type AiVideoView } from "../ui-state";

const video = (over: Partial<AiVideoView>): AiVideoView => ({
  id: "v",
  status: "draft",
  template: "bold",
  voice: "warm",
  aspect: "9:16",
  scriptOriginal: "x y z",
  scriptTrimmed: null,
  outputUrl: null,
  durationSeconds: null,
  error: null,
  createdAt: "2026-10-01T00:00:00Z",
  ...over,
});

describe("summarizeCredits", () => {
  it("reports remaining credits", () => {
    expect(summarizeCredits({ limit: 10, used: 3, remaining: 7 })).toMatchObject({ blocked: false, text: "7 of 10 credits left this month" });
    expect(summarizeCredits({ limit: 1, used: 0, remaining: 1 }).text).toBe("1 of 1 credit left this month");
  });

  it("blocks when none are left or the plan has none", () => {
    expect(summarizeCredits({ limit: 10, used: 10, remaining: 0 })).toMatchObject({ blocked: true });
    expect(summarizeCredits({ limit: 0, used: 0, remaining: 0 })).toMatchObject({ blocked: true, text: "AI video is not included in your plan" });
  });

  it("treats a null limit as unlimited, even though remaining is null too (Infinity becomes null in JSON)", () => {
    expect(summarizeCredits({ limit: null, used: 4, remaining: null })).toMatchObject({ unlimited: true, blocked: false });
  });

  it("derives remaining when the API omitted it", () => {
    expect(summarizeCredits({ limit: 5, used: 2, remaining: null }).text).toBe("3 of 5 credits left this month");
  });
});

describe("shouldPoll / pickActiveVideo", () => {
  it("polls only while a video is being created", () => {
    expect(shouldPoll([video({ status: "done" }), video({ status: "draft" })])).toBe(false);
    expect(shouldPoll([video({ status: "done" }), video({ status: "rendering" })])).toBe(true);
    expect(shouldPoll([video({ status: "queued" })])).toBe(true);
  });

  it("opens an in-flight video first, then the newest draft, else nothing", () => {
    const videos = [
      video({ id: "old-draft", createdAt: "2026-10-01T00:00:00Z" }),
      video({ id: "new-draft", createdAt: "2026-10-03T00:00:00Z" }),
      video({ id: "rendering", status: "rendering", createdAt: "2026-10-02T00:00:00Z" }),
      video({ id: "done", status: "done", createdAt: "2026-10-04T00:00:00Z" }),
    ];
    expect(pickActiveVideo(videos)).toBe("rendering");
    expect(pickActiveVideo(videos.filter((v) => v.id !== "rendering"))).toBe("new-draft");
    expect(pickActiveVideo(videos.filter((v) => v.status === "done"))).toBeNull();
  });
});

describe("reviewScript", () => {
  const original = "I really loved this product and it saved us hours every week.";

  it("accepts a deletion and counts what was removed", () => {
    const review = reviewScript(original, "I loved this product, it saved us hours.");
    expect(review.check).toEqual({ ok: true });
    expect(review.trimmed).toBe(true);
    expect(review.removedWords).toBe(4);
  });

  it("flags an edit that adds words, using the server's rule", () => {
    const review = reviewScript(original, "I really loved this amazing product");
    expect(review.check.ok).toBe(false);
  });

  it("reports an unchanged script as not trimmed", () => {
    expect(reviewScript(original, original)).toMatchObject({ trimmed: false, removedWords: 0 });
  });
});

describe("ScriptDiff", () => {
  it("strikes through removed words and announces them to screen readers", () => {
    const html = renderToStaticMarkup(createElement(ScriptDiff, { tokens: diffRemovedWords("I really loved it", "I loved it") }));
    expect(html).toContain("<del");
    expect(html).toContain("(removed) ");
    expect(html).toContain("really");
    expect(html.match(/<del/g)).toHaveLength(1);
  });

  it("renders the kept words as plain text, in order", () => {
    const html = renderToStaticMarkup(createElement(ScriptDiff, { tokens: diffRemovedWords("a b c", "a b c") }));
    expect(html).not.toContain("<del");
    expect(html.replace(/<[^>]+>/g, "")).toBe("a b c");
  });
});
