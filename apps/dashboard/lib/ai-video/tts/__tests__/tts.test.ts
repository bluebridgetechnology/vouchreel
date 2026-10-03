import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsProvider } from "../elevenlabs";
import { MockTtsProvider } from "../mock";
import { getTtsProvider, isTtsConfigured } from "../index";
import { TtsError } from "../types";
import { wordsFromCharacterAlignment } from "../words";

const alignment = {
  characters: [..."Hi  you!"],
  character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
  character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
};

describe("wordsFromCharacterAlignment", () => {
  it("groups characters into words with start of first and end of last char", () => {
    expect(wordsFromCharacterAlignment(alignment)).toEqual([
      { word: "Hi", start: 0, end: 0.2 },
      { word: "you!", start: 0.4, end: 0.8 },
    ]);
  });

  it("returns nothing for empty alignment", () => {
    expect(wordsFromCharacterAlignment({ characters: [], character_start_times_seconds: [], character_end_times_seconds: [] })).toEqual([]);
  });
});

describe("MockTtsProvider", () => {
  it("returns a valid silent WAV whose length matches the word timings", async () => {
    const result = await new MockTtsProvider().synthesize({ text: "one two three", voiceId: "warm" });
    expect(result.audio.subarray(0, 4).toString()).toBe("RIFF");
    expect(result.words).toHaveLength(3);
    expect(result.durationSeconds).toBeCloseTo(1.2);
    expect(result.costCents).toBe(0);
  });

  it("rejects an unknown voice with a non-retryable error", async () => {
    await expect(new MockTtsProvider().synthesize({ text: "x", voiceId: "nope" })).rejects.toMatchObject({ retryable: false });
  });
});

describe("ElevenLabsProvider", () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("requires an API key", () => {
    expect(() => new ElevenLabsProvider("")).toThrow(/ELEVENLABS_API_KEY/);
  });

  it("calls the with-timestamps endpoint and maps the response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ audio_base64: Buffer.from("mp3").toString("base64"), alignment }), { status: 200 })
    );
    const result = await new ElevenLabsProvider("key").synthesize({ text: "Hi  you!", voiceId: "warm" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/text-to-speech/21m00Tcm4TlvDq8ikWAM/with-timestamps");
    expect(init.headers["xi-api-key"]).toBe("key");
    expect(JSON.parse(init.body)).toEqual({ text: "Hi  you!", model_id: "eleven_multilingual_v2" });
    expect(result.audio.toString()).toBe("mp3");
    expect(result.mimeType).toBe("audio/mpeg");
    expect(result.words.map((w) => w.word)).toEqual(["Hi", "you!"]);
    expect(result.durationSeconds).toBe(0.8);
    expect(result.costCents).toBe(1);
  });

  it.each([
    [401, false],
    [429, true],
    [500, true],
    [422, false],
  ])("maps HTTP %i to retryable=%s", async (status, retryable) => {
    fetchMock.mockResolvedValue(new Response("nope", { status }));
    const error = await new ElevenLabsProvider("key").synthesize({ text: "x", voiceId: "warm" }).catch((e) => e);
    expect(error).toBeInstanceOf(TtsError);
    expect(error.retryable).toBe(retryable);
  });

  it("treats a network failure as retryable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(new ElevenLabsProvider("key").synthesize({ text: "x", voiceId: "warm" })).rejects.toMatchObject({ retryable: true });
  });

  it("rejects a response without alignment instead of producing uncaptioned video", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ audio_base64: "AAAA" }), { status: 200 }));
    await expect(new ElevenLabsProvider("key").synthesize({ text: "x", voiceId: "warm" })).rejects.toBeInstanceOf(TtsError);
  });
});

describe("getTtsProvider", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("uses ElevenLabs when a key is set", () => {
    process.env.ELEVENLABS_API_KEY = "k";
    delete process.env.AI_VIDEO_TTS_PROVIDER;
    expect(getTtsProvider().name).toBe("elevenlabs");
  });

  it("falls back to mock outside production", () => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.AI_VIDEO_TTS_PROVIDER;
    (process.env as Record<string, string>).NODE_ENV = "development";
    expect(getTtsProvider().name).toBe("mock");
  });

  it("refuses to silently mock in production", () => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.AI_VIDEO_TTS_PROVIDER;
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(() => getTtsProvider()).toThrow(/not configured/);
    expect(isTtsConfigured()).toBe(false);
  });

  it("allows an explicit mock in production", () => {
    process.env.AI_VIDEO_TTS_PROVIDER = "mock";
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(getTtsProvider().name).toBe("mock");
  });
});
