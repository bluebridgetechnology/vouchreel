import { describe, expect, it } from "vitest";
import { baseMimeType, matchesDeclaredType, sniffVideoKind } from "../video-sniff";

const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

const mp4 = bytes([0, 0, 0, 0x20], "ftyp", "isom", [0, 0, 0, 0]);
const mov = bytes([0, 0, 0, 0x14], "ftyp", "qt  ", [0, 0, 0, 0]);
const webm = bytes([0x1a, 0x45, 0xdf, 0xa3], [0, 0, 0, 0, 0, 0, 0, 0]);
const avi = bytes("RIFF", [0, 0, 0, 0], "AVI ", "LIST");
const exe = bytes("MZ", [0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff]);
const html = bytes("<html><body>", "x");

describe("sniffVideoKind", () => {
  it("recognises the four accepted containers", () => {
    expect(sniffVideoKind(mp4)).toBe("mp4");
    expect(sniffVideoKind(mov)).toBe("mov");
    expect(sniffVideoKind(webm)).toBe("webm");
    expect(sniffVideoKind(avi)).toBe("avi");
  });

  it("rejects executables, HTML, truncated and empty data", () => {
    expect(sniffVideoKind(exe)).toBeNull();
    expect(sniffVideoKind(html)).toBeNull();
    expect(sniffVideoKind(bytes("ftyp"))).toBeNull();
    expect(sniffVideoKind(new Uint8Array())).toBeNull();
  });
});

describe("matchesDeclaredType", () => {
  it("accepts matching declarations", () => {
    expect(matchesDeclaredType("video/mp4", mp4)).toBe(true);
    expect(matchesDeclaredType("video/quicktime", mov)).toBe(true);
    expect(matchesDeclaredType("video/webm", webm)).toBe(true);
    expect(matchesDeclaredType("video/x-msvideo", avi)).toBe(true);
  });

  it("rejects a file whose bytes disagree with its declared type", () => {
    expect(matchesDeclaredType("video/mp4", exe)).toBe(false);
    expect(matchesDeclaredType("video/mp4", html)).toBe(false);
    expect(matchesDeclaredType("video/webm", mp4)).toBe(false);
  });

  it("rejects undeclared MIME types", () => {
    expect(matchesDeclaredType("application/octet-stream", mp4)).toBe(false);
  });

  it("accepts browser recordings whose MIME type carries codec parameters", () => {
    expect(matchesDeclaredType("video/webm;codecs=vp8,opus", webm)).toBe(true);
    expect(matchesDeclaredType("video/mp4;codecs=avc1.42E01E,mp4a.40.2", mp4)).toBe(true);
    expect(matchesDeclaredType("VIDEO/WEBM; codecs=vp9", webm)).toBe(true);
  });

  it("still checks the bytes when parameters are present", () => {
    expect(matchesDeclaredType("video/webm;codecs=vp8,opus", exe)).toBe(false);
  });

  it("baseMimeType strips parameters and normalizes case", () => {
    expect(baseMimeType("Video/WebM; codecs=vp9,opus")).toBe("video/webm");
    expect(baseMimeType("video/mp4")).toBe("video/mp4");
  });
});
