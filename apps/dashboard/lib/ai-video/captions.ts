import type { WordTiming } from "./tts/types";

export interface CaptionChunk {
  text: string;
  start: number;
  end: number;
}

const MAX_WORDS_PER_CHUNK = 6;
const MAX_CHARS_PER_CHUNK = 34;

/**
 * Groups word timings into short on-screen captions. A chunk ends at sentence punctuation, or
 * when it hits the word/character cap. Each chunk stays up until the next one starts (and the
 * last until `endAt`), so the screen is never blank mid-narration.
 */
export function buildCaptionChunks(words: WordTiming[], endAt: number): CaptionChunk[] {
  const groups: WordTiming[][] = [];
  let current: WordTiming[] = [];
  for (const w of words) {
    const chars = current.reduce((n, c) => n + c.word.length + 1, 0) + w.word.length;
    if (current.length && (current.length >= MAX_WORDS_PER_CHUNK || chars > MAX_CHARS_PER_CHUNK)) {
      groups.push(current);
      current = [];
    }
    current.push(w);
    if (/[.!?]["')\]]*$/.test(w.word)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);

  return groups.map((group, i) => ({
    text: group.map((w) => w.word).join(" "),
    start: group[0].start,
    end: i + 1 < groups.length ? groups[i + 1][0].start : Math.max(endAt, group[group.length - 1].end),
  }));
}
