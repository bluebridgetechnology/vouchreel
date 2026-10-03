import { TtsError, type TtsProvider, type TtsRequest, type TtsResult, type WordTiming } from "./types";
import { getVoice } from "./voices";

const SAMPLE_RATE = 8000;
const SECONDS_PER_WORD = 0.4;

/** Silent WAV of the given length (16-bit mono PCM). Keeps dev and tests free of API keys. */
export function silentWav(seconds: number): Buffer {
  const samples = Math.max(1, Math.round(seconds * SAMPLE_RATE));
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

export class MockTtsProvider implements TtsProvider {
  readonly name = "mock";

  async synthesize({ text, voiceId }: TtsRequest): Promise<TtsResult> {
    if (!getVoice(voiceId)) throw new TtsError(`Unknown voice "${voiceId}"`, "That voice is not available.", false);
    const words: WordTiming[] = text
      .split(/\s+/)
      .filter(Boolean)
      .map((word, i) => ({ word, start: i * SECONDS_PER_WORD, end: (i + 1) * SECONDS_PER_WORD }));
    const durationSeconds = words.length * SECONDS_PER_WORD;
    return {
      audio: silentWav(durationSeconds),
      mimeType: "audio/wav",
      words,
      durationSeconds,
      characters: text.length,
      costCents: 0,
    };
  }
}
