import { describe, expect, it } from "vitest";
import {
  MAX_SCRIPT_WORDS,
  addedWords,
  comparableWords,
  countWords,
  diffRemovedWords,
  isOrderedSubset,
  proposeTrim,
  validateTrim,
} from "../trim";

const long =
  "I was skeptical at first. We tried three other tools and none of them stuck. " +
  "Then a friend suggested Vouchreel and within a week our conversion rate jumped by forty percent. " +
  "The setup took ten minutes. Support answered every question the same day. " +
  "Honestly the best purchase we made this year, and we recommend it to every founder we meet. " +
  "Our whole team uses it daily now and the dashboards are genuinely useful for planning.";

describe("validateTrim", () => {
  const original = "I really loved this product and it saved us hours every week.";

  it("accepts the unchanged text", () => {
    expect(validateTrim(original, original)).toEqual({ ok: true });
  });

  it("accepts a deletion-only trim, ignoring case and punctuation", () => {
    expect(validateTrim(original, "I loved this product, it saved us hours.")).toEqual({ ok: true });
  });

  it("rejects an added word", () => {
    const result = validateTrim(original, "I really loved this amazing product");
    expect(result.ok).toBe(false);
  });

  it("rejects reordered words", () => {
    expect(validateTrim(original, "product this loved I really").ok).toBe(false);
  });

  it("rejects a reworded phrase even when it sounds the same", () => {
    expect(validateTrim(original, "I really liked this product").ok).toBe(false);
  });

  it("rejects scripts that are too short or too long", () => {
    expect(validateTrim(original, "I loved").ok).toBe(false);
    const many = Array.from({ length: MAX_SCRIPT_WORDS + 5 }, (_, i) => `w${i}`).join(" ");
    expect(validateTrim(many, many).ok).toBe(false);
  });

  it("does not let a word be reused more times than the original has it", () => {
    expect(validateTrim("great product", "great great great product").ok).toBe(false);
  });

  it("handles non-English text", () => {
    expect(validateTrim("Me encantó este producto, ahorramos mucho tiempo.", "Me encantó este producto.")).toEqual({ ok: true });
  });
});

describe("proposeTrim", () => {
  it("returns text within the limit untouched (whitespace normalised)", () => {
    expect(proposeTrim("  Great   product.\nLoved it. ")).toBe("Great product. Loved it.");
  });

  it("shortens long text to the limit, using whole sentences", () => {
    expect(countWords(long)).toBeGreaterThan(MAX_SCRIPT_WORDS);
    const trimmed = proposeTrim(long);
    expect(countWords(trimmed)).toBeLessThanOrEqual(MAX_SCRIPT_WORDS);
    expect(trimmed.startsWith("I was skeptical at first.")).toBe(true);
    expect(trimmed.endsWith(".")).toBe(true);
  });

  it("only ever deletes: output is an ordered subset of the input", () => {
    expect(isOrderedSubset(long, proposeTrim(long))).toBe(true);
    expect(validateTrim(long, proposeTrim(long))).toEqual({ ok: true });
  });

  it("cuts a single very long sentence at a clause break", () => {
    const run = Array.from({ length: 40 }, (_, i) => `alpha${i}`).join(" ");
    const sentence = `${run}, then ${run}, and finally ${run}.`;
    const trimmed = proposeTrim(sentence);
    expect(countWords(trimmed)).toBeLessThanOrEqual(MAX_SCRIPT_WORDS);
    expect(isOrderedSubset(sentence, trimmed)).toBe(true);
  });

  it("stays valid for a single long sentence with no punctuation", () => {
    const sentence = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const trimmed = proposeTrim(sentence);
    expect(countWords(trimmed)).toBe(MAX_SCRIPT_WORDS);
    expect(isOrderedSubset(sentence, trimmed)).toBe(true);
  });
});

describe("diffRemovedWords", () => {
  it("marks exactly the removed words", () => {
    const diff = diffRemovedWords("I really loved this product", "I loved this product");
    expect(diff.map((d) => [d.text, d.removed])).toEqual([
      ["I", false],
      ["really", true],
      ["loved", false],
      ["this", false],
      ["product", false],
    ]);
  });

  it("marks nothing removed when the text is unchanged", () => {
    expect(diffRemovedWords("Great product!", "Great product!").every((d) => !d.removed)).toBe(true);
  });
});

describe("changed words", () => {
  const original = "We tried three other tools and none of them stuck. Honestly the best purchase we made.";

  it("names the words that are not in the customer's text", () => {
    expect(addedWords(original, "We tried five other tools")).toEqual(["five"]);
    const result = validateTrim(original, "We tried five other tools and none of them stuck");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/Not in the customer's text: five\./);
  });

  it("only flags the changed word in the diff, not everything after it", () => {
    const diff = diffRemovedWords(original, "We tried five other tools and none of them stuck.");
    const removed = diff.filter((d) => d.removed).map((d) => d.text);
    // "three" was replaced (so it counts as removed from the original); the rest that was kept is not flagged
    expect(removed).toContain("three");
    expect(removed).not.toContain("other");
    expect(removed).not.toContain("stuck.");
  });

  it("flags nothing for an identical text and everything for an unrelated one", () => {
    expect(diffRemovedWords("a b c", "a b c").some((d) => d.removed)).toBe(false);
    expect(diffRemovedWords("a b c", "x y z").every((d) => d.removed)).toBe(true);
  });

  it("handles a long original efficiently", () => {
    const long = Array.from({ length: 800 }, (_, i) => `w${i}`).join(" ");
    const started = Date.now();
    diffRemovedWords(long, "w5 w300 w799");
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe("comparableWords", () => {
  it("lowercases and strips punctuation but keeps apostrophes inside words", () => {
    expect(comparableWords("Don't STOP, believing!")).toEqual(["don't", "stop", "believing"]);
  });
});
