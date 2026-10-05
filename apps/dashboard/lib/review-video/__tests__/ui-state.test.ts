import { describe, expect, it } from "vitest";
import {
  checkSelection,
  estimateSeconds,
  posterSrc,
  pruneSelection,
  reviewPickState,
  shouldPoll,
  templateBlockedReason,
  toggleSelection,
  type ReviewOptionView,
  type TemplateView,
} from "../ui-state";

const single: TemplateView = { id: "spotlight", label: "Spotlight", description: "", reviews: { min: 1, max: 1 }, requiresAggregate: false, maxChars: 400 };
const stack: TemplateView = { id: "stack", label: "Review stack", description: "", reviews: { min: 3, max: 5 }, requiresAggregate: false, maxChars: 240 };
const rating: TemplateView = { id: "rating-spotlight", label: "Rating spotlight", description: "", reviews: { min: 1, max: 1 }, requiresAggregate: true, maxChars: 320 };

const review = (id: string, fits: string[], text = "A perfectly reasonable review text here."): ReviewOptionView => ({
  id,
  author: `Author ${id}`,
  rating: 5,
  text,
  source: "google",
  date: "March 2026",
  fits,
});

describe("templateBlockedReason", () => {
  const reviews = [review("a", ["spotlight", "stack", "rating-spotlight"])];

  it("blocks the rating template until the provider totals are known", () => {
    expect(templateBlockedReason(rating, [], reviews)).toMatch(/after your next review sync/);
    expect(templateBlockedReason(rating, [{ source: "google", rating: 4.8, total: 200 }], reviews)).toBeNull();
  });

  it("blocks a template none of the reviews fit, or with too few suitable reviews", () => {
    expect(templateBlockedReason(single, [], [review("x", [])])).toMatch(/None of your reviews/);
    expect(templateBlockedReason(stack, [], reviews)).toMatch(/at least 3/);
    expect(templateBlockedReason(stack, [], [review("a", ["stack"]), review("b", ["stack"]), review("c", ["stack"])])).toBeNull();
  });
});

describe("selection", () => {
  const long = review("long", ["spotlight"], "x".repeat(300));

  it("a single-review template swaps the pick instead of adding", () => {
    expect(toggleSelection(["a"], "b", single)).toEqual(["b"]);
    expect(toggleSelection(["a"], "a", single)).toEqual([]);
  });

  it("a stack keeps the order picked and stops at the maximum", () => {
    let picked: string[] = [];
    for (const id of ["c", "a", "b", "d", "e", "f"]) picked = toggleSelection(picked, id, stack);
    expect(picked).toEqual(["c", "a", "b", "d", "e"]);
    expect(toggleSelection(picked, "a", stack)).toEqual(["c", "b", "d", "e"]);
  });

  it("disables reviews that are too long for the template, with a reason", () => {
    expect(reviewPickState(long, stack, [])).toEqual({ disabled: true, reason: expect.stringContaining("Too long") });
    expect(reviewPickState(long, single, [])).toEqual({ disabled: false, reason: null });
  });

  it("disables more picks once a stack is full, but keeps picked ones clickable", () => {
    const full = ["1", "2", "3", "4", "5"];
    expect(reviewPickState(review("6", ["stack"]), stack, full).disabled).toBe(true);
    expect(reviewPickState(review("3", ["stack"]), stack, full).disabled).toBe(false);
  });

  it("drops picks that no longer fit when the template changes", () => {
    const reviews = [review("a", ["spotlight"]), review("b", ["spotlight", "stack"])];
    expect(pruneSelection(["a", "b"], stack, reviews)).toEqual(["b"]);
    expect(pruneSelection(["a", "b"], single, reviews)).toEqual(["a"]);
  });
});

describe("checkSelection", () => {
  it("says what is still missing, in order", () => {
    expect(checkSelection(single, [], false).message).toBe("Pick a review.");
    expect(checkSelection(stack, ["a"], false).message).toMatch(/at least 3.*1 so far/);
    expect(checkSelection(single, ["a"], false).message).toMatch(/Confirm you may use/);
    expect(checkSelection(single, ["a"], true)).toEqual({ ready: true, message: "" });
  });
});

describe("estimateSeconds and polling", () => {
  it("estimates longer videos for more text and for stacks", () => {
    const shortOne = estimateSeconds(single, [review("a", [], "Great. Loved it a lot.")], [])!;
    const longOne = estimateSeconds(single, [review("a", [], Array(70).fill("word").join(" "))], [])!;
    expect(longOne).toBeGreaterThan(shortOne);
    const three = estimateSeconds(stack, [review("a", []), review("b", []), review("c", [])], [])!;
    expect(three).toBeGreaterThan(shortOne);
  });

  it("returns null until enough reviews are picked", () => {
    expect(estimateSeconds(stack, [review("a", [])], [])).toBeNull();
  });

  it("polls only while a video is being created", () => {
    expect(shouldPoll([{ status: "done" }, { status: "failed" }])).toBe(false);
    expect(shouldPoll([{ status: "done" }, { status: "rendering" }])).toBe(true);
    expect(shouldPoll([{ status: "queued" }])).toBe(true);
  });
});

describe("posterSrc", () => {
  it("opens the player on a later frame, since every template starts empty", () => {
    expect(posterSrc("https://cdn.test/v.mp4", 12)).toBe("https://cdn.test/v.mp4#t=7");
    expect(posterSrc("https://cdn.test/v.mp4", 27)).toBe("https://cdn.test/v.mp4#t=16");
  });

  it("falls back to 2 seconds for short or unknown lengths", () => {
    expect(posterSrc("https://cdn.test/v.mp4", null)).toBe("https://cdn.test/v.mp4#t=2");
    expect(posterSrc("https://cdn.test/v.mp4", 3)).toBe("https://cdn.test/v.mp4#t=2");
  });
});
