import { describe, expect, it } from "vitest";
import {
  checkSelection,
  estimateSeconds,
  posterSrc,
  fitsTemplate,
  pruneSelection,
  shownText,
  usableInTemplate,
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

describe("a font changes what fits", () => {
  const tmpl: TemplateView = { id: "spotlight", label: "Spotlight", description: "", reviews: { min: 1, max: 1 }, requiresAggregate: false, maxChars: 400 };
  const medium = review("m", ["spotlight"], "x".repeat(380)); // fits Spotlight in the default font

  it("uses the server's answer when no font is chosen, and works it out from the text when one is", () => {
    expect(fitsTemplate(medium, tmpl)).toBe(true);
    expect(fitsTemplate(medium, tmpl, "outfit")).toBe(true);
    expect(fitsTemplate(medium, tmpl, "jetbrains-mono")).toBe(false); // that font fits at most 340
    expect(fitsTemplate(review("s", [], "short"), tmpl, "outfit")).toBe(false); // under 12 characters
  });

  it("a pick that no longer fits whole in a wider font stays usable and is flagged as shortened, with that font's limit", () => {
    expect(reviewPickState(medium, tmpl, [])).toEqual({ disabled: false, reason: null, shortened: false });
    expect(reviewPickState(medium, tmpl, [], "jetbrains-mono")).toEqual({ disabled: false, reason: "Will be shortened to 340 characters, ending with …", shortened: true });
    expect(pruneSelection(["m"], tmpl, [medium], "jetbrains-mono")).toEqual(["m"]);
    expect(shownText(medium, tmpl, "jetbrains-mono").text.length).toBeLessThanOrEqual(340);
  });

  it("a review under 12 characters cannot be used, in any font", () => {
    const tiny = review("t", [], "too short");
    expect(usableInTemplate(tiny, tmpl, "outfit")).toBe(false);
    expect(pruneSelection(["t"], tmpl, [tiny], "jetbrains-mono")).toEqual([]);
    expect(templateBlockedReason(tmpl, [], [tiny], "jetbrains-mono")).toMatch(/None of your reviews/);
    expect(templateBlockedReason(tmpl, [], [medium], "jetbrains-mono")).toBeNull();
  });
});

describe("templateBlockedReason", () => {
  const reviews = [review("a", ["spotlight", "stack", "rating-spotlight"])];

  it("blocks the rating template until the provider totals are known", () => {
    expect(templateBlockedReason(rating, [], reviews)).toMatch(/after your next review sync/);
    expect(templateBlockedReason(rating, [{ source: "google", rating: 4.8, total: 200 }], reviews)).toBeNull();
  });

  it("blocks a template none of the reviews fit, or with too few suitable reviews", () => {
    expect(templateBlockedReason(single, [], [review("x", [], "too short")])).toMatch(/None of your reviews/);
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

  it("a review too long for the template can still be picked, and says it will be shortened", () => {
    expect(reviewPickState(long, stack, [])).toEqual({ disabled: false, reason: "Will be shortened to 240 characters, ending with …", shortened: true });
    expect(reviewPickState(long, stack, ["long"])).toMatchObject({ disabled: false, shortened: true });
    expect(reviewPickState(long, single, [])).toEqual({ disabled: false, reason: null, shortened: false });
  });

  it("a review that is too short is disabled with a reason", () => {
    expect(reviewPickState(review("t", [], "tiny"), single, [])).toEqual({ disabled: true, reason: expect.stringContaining("Too short") });
  });

  it("the text shown is whole when it fits and cut with an ellipsis when it does not", () => {
    expect(shownText(long, single).shortened).toBe(false);
    const cut = shownText(long, stack);
    expect(cut.shortened).toBe(true);
    expect(cut.text.length).toBeLessThanOrEqual(240);
    expect(cut.text.endsWith("…")).toBe(true);
    expect(cut.originalLength).toBe(300);
  });

  it("disables more picks once a stack is full, but keeps picked ones clickable", () => {
    const full = ["1", "2", "3", "4", "5"];
    expect(reviewPickState(review("6", ["stack"]), stack, full).disabled).toBe(true);
    expect(reviewPickState(review("3", ["stack"]), stack, full).disabled).toBe(false);
  });

  it("keeps picks when the template changes (a longer one is shortened), and drops only what exceeds the new maximum", () => {
    const reviews = [review("a", ["spotlight"]), review("b", ["spotlight", "stack"])];
    expect(pruneSelection(["a", "b"], stack, reviews)).toEqual(["a", "b"]);
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

describe("reviews whose source is switched off", () => {
  const off = "Videos from Google reviews are not switched on yet. You can add a review of your own instead.";
  const blocked = { ...review("g", ["spotlight"]), videoBlocked: off };
  const own: ReviewOptionView = { ...review("o", ["spotlight"], "Written by the owner, on their own site."), source: "own", videoBlocked: null };

  it("cannot be picked, and says why", () => {
    expect(reviewPickState(blocked, single, [])).toEqual({ disabled: true, reason: off });
    expect(reviewPickState(own, single, [])).toMatchObject({ disabled: false });
    expect(usableInTemplate(blocked, single)).toBe(false);
  });

  it("is dropped from a pick, and a template with nothing else to use explains the switch", () => {
    expect(pruneSelection(["g", "o"], stack, [blocked, own])).toEqual(["o"]);
    expect(templateBlockedReason(single, [], [blocked])).toBe(off);
    expect(templateBlockedReason(single, [], [blocked, own])).toBeNull();
  });
});
