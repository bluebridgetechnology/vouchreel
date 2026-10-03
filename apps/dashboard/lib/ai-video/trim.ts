/**
 * Script trimming for AI video. The rule that matters legally and ethically: a trim may only
 * DELETE words from the customer's text. It can never add, reorder or reword, so the video
 * says only what the customer wrote. validateTrim enforces that for both our proposal and any
 * edit the owner makes.
 */

/** About 25 seconds of narration at a natural pace; keeps videos social-length. */
export const MAX_SCRIPT_WORDS = 60;
export const MIN_SCRIPT_WORDS = 3;

/** Lowercased words with punctuation stripped, used only for comparison (never for output). */
export function comparableWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^['’-]+|['’-]+$/g, ""))
    .filter(Boolean);
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export type TrimCheck = { ok: true } | { ok: false; reason: string };

/** True when every word of `trimmed` appears in `original`, in the same order. */
export function isOrderedSubset(original: string, trimmed: string): boolean {
  const source = comparableWords(original);
  let i = 0;
  for (const word of comparableWords(trimmed)) {
    while (i < source.length && source[i] !== word) i++;
    if (i === source.length) return false;
    i++;
  }
  return true;
}

export function validateTrim(original: string, trimmed: string): TrimCheck {
  const words = countWords(trimmed);
  if (words < MIN_SCRIPT_WORDS) return { ok: false, reason: `The script needs at least ${MIN_SCRIPT_WORDS} words.` };
  if (words > MAX_SCRIPT_WORDS) {
    return { ok: false, reason: `The script can be at most ${MAX_SCRIPT_WORDS} words (it has ${words}).` };
  }
  if (!isOrderedSubset(original, trimmed)) {
    return { ok: false, reason: "The script can only remove words from the customer's text, not add or change them." };
  }
  return { ok: true };
}

/** Splits into sentences, keeping the terminal punctuation with each. */
function splitSentences(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()) ?? [];
}

/**
 * Proposes a length-only trim: whole sentences, in order. Text already within the limit is
 * returned untouched. Sentences are kept greedily while they fit, preferring the opening one
 * (it usually carries the verdict); if even the first sentence is too long it is cut at the
 * last clause break before the limit. Output is always an ordered subset of the input.
 */
export function proposeTrim(original: string, maxWords = MAX_SCRIPT_WORDS): string {
  const text = original.replace(/\s+/g, " ").trim();
  if (countWords(text) <= maxWords) return text;

  const kept: string[] = [];
  let used = 0;
  for (const sentence of splitSentences(text)) {
    const n = countWords(sentence);
    if (used + n > maxWords) continue; // skip a sentence that does not fit; a later short one still may
    kept.push(sentence);
    used += n;
  }
  if (kept.length) return kept.join(" ");

  // Single very long sentence: cut at the last comma/semicolon within the limit, else hard cut
  const words = text.split(" ").slice(0, maxWords);
  const lastBreak = words.findLastIndex((w) => /[,;:]$/.test(w));
  const cut = lastBreak >= MIN_SCRIPT_WORDS ? words.slice(0, lastBreak + 1) : words;
  return cut.join(" ").replace(/[,;:]$/, "") + ".";
}

export interface DiffToken {
  text: string;
  /** True when this word was removed from the original. */
  removed: boolean;
}

/** Marks which original words the trim removed, for showing the owner a diff before approval. */
export function diffRemovedWords(original: string, trimmed: string): DiffToken[] {
  const kept = comparableWords(trimmed);
  let k = 0;
  return original
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const [word] = comparableWords(raw);
      if (word !== undefined && k < kept.length && word === kept[k]) {
        k++;
        return { text: raw, removed: false };
      }
      return { text: raw, removed: true };
    });
}
