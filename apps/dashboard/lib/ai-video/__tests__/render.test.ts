import { describe, expect, it } from "vitest";
import { buildCaptionChunks } from "../captions";
import { TAIL_SECONDS, buildAiVideoArgs, wrapText } from "../render-args";
import { AI_VIDEO_LABEL, AI_VIDEO_TEMPLATES, getTemplate } from "../templates";

const words = (text: string, perWord = 0.4) =>
  text.split(" ").map((word, i) => ({ word, start: i * perWord, end: (i + 1) * perWord }));

describe("buildCaptionChunks", () => {
  it("splits at sentence ends and caps chunk size", () => {
    const chunks = buildCaptionChunks(words("Loved it. The setup took ten minutes and support was fast every single time."), 8);
    expect(chunks[0].text).toBe("Loved it.");
    expect(chunks.every((c) => c.text.split(" ").length <= 6)).toBe(true);
    expect(chunks.map((c) => c.text).join(" ")).toBe("Loved it. The setup took ten minutes and support was fast every single time.");
  });

  it("keeps each caption up until the next starts, and the last until the end", () => {
    const chunks = buildCaptionChunks(words("One two. Three four."), 3);
    expect(chunks[0].end).toBe(chunks[1].start);
    expect(chunks[1].end).toBe(3);
  });

  it("returns nothing for no words", () => {
    expect(buildCaptionChunks([], 5)).toEqual([]);
  });
});

describe("wrapText", () => {
  it("wraps on spaces without exceeding the width, and never splits a word", () => {
    const wrapped = wrapText("this is a fairly long caption line", 12);
    expect(wrapped.split("\n").every((l) => l.length <= 12)).toBe(true);
    expect(wrapped.replace(/\n/g, " ")).toBe("this is a fairly long caption line");
  });

  it("leaves an over-long single word on its own line", () => {
    expect(wrapText("supercalifragilistic ok", 8)).toBe("supercalifragilistic\nok");
  });
});

describe("buildAiVideoArgs", () => {
  const base = {
    audioPath: "/tmp/a.mp3",
    outputPath: "/tmp/o.mp4",
    template: getTemplate("bold")!,
    aspect: "9:16" as const,
    durationSeconds: 10,
    captions: [
      { textFile: "/tmp/c0.txt", start: 0, end: 2 },
      { textFile: "/tmp/c1.txt", start: 2, end: 10 },
    ],
    labelFile: "/tmp/label.txt",
  };
  const vf = (args: string[]) => args[args.indexOf("-vf") + 1];

  it("renders the right canvas and length for each aspect", () => {
    const portrait = buildAiVideoArgs(base);
    expect(portrait.join(" ")).toContain("s=1080x1920");
    expect(portrait.join(" ")).toContain(`d=${(10 + TAIL_SECONDS).toFixed(3)}`);
    expect(buildAiVideoArgs({ ...base, aspect: "16:9" }).join(" ")).toContain("s=1920x1080");
  });

  it("times each caption with enable and fades it in", () => {
    const filter = vf(buildAiVideoArgs(base));
    expect(filter).toContain("enable='between(t,0.000,2.000)'");
    expect(filter).toContain("enable='between(t,2.000,10.000)'");
    expect(filter).toContain("alpha='min(1,(t-2.000)/0.2)'");
  });

  it("always includes the AI-generated label, with or without a watermark", () => {
    expect(vf(buildAiVideoArgs(base))).toContain("textfile='/tmp/label.txt'");
    const withWatermark = vf(buildAiVideoArgs({ ...base, watermarkFile: "/tmp/wm.txt" }));
    expect(withWatermark).toContain("textfile='/tmp/wm.txt'");
    expect(vf(buildAiVideoArgs(base))).not.toContain("wm.txt");
  });

  it("reads text from files so customer text never needs filter escaping", () => {
    const filter = vf(buildAiVideoArgs(base));
    expect(filter).not.toContain("text='");
    expect(filter).toContain("textfile=");
  });

  it("maps video and narration audio and produces a faststart MP4", () => {
    const args = buildAiVideoArgs(base);
    expect(args).toEqual(expect.arrayContaining(["-map", "0:v", "-map", "1:a", "-movflags", "+faststart"]));
    expect(args.at(-1)).toBe("/tmp/o.mp4");
  });

  it("uses the template colours", () => {
    const midnight = getTemplate("midnight")!;
    const args = buildAiVideoArgs({ ...base, template: midnight }).join(" ");
    expect(args).toContain(`color=c=0x${midnight.background}`);
    expect(vf(buildAiVideoArgs({ ...base, template: midnight }))).toContain(`fontcolor=0x${midnight.text}`);
  });
});

describe("templates", () => {
  it("has three templates with unique ids and the disclosure label", () => {
    expect(AI_VIDEO_TEMPLATES).toHaveLength(3);
    expect(new Set(AI_VIDEO_TEMPLATES.map((t) => t.id)).size).toBe(3);
    expect(AI_VIDEO_LABEL).toMatch(/AI-generated/);
  });
});
