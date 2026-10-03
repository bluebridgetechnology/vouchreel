import type { WordTiming } from "./types";

/**
 * Groups ElevenLabs per-character alignment into per-word timings. Whitespace ends a word;
 * each word spans from its first character's start to its last character's end.
 */
export function wordsFromCharacterAlignment(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): WordTiming[] {
  const words: WordTiming[] = [];
  let current = "";
  let start = 0;
  let end = 0;
  const flush = () => {
    if (current) words.push({ word: current, start, end });
    current = "";
  };
  alignment.characters.forEach((char, i) => {
    if (/\s/.test(char)) {
      flush();
      return;
    }
    if (!current) start = alignment.character_start_times_seconds[i];
    current += char;
    end = alignment.character_end_times_seconds[i];
  });
  flush();
  return words;
}
