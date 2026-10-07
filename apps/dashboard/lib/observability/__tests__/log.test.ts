import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log, setErrorReporter } from "@/lib/log";

const out = { log: vi.spyOn(console, "log").mockImplementation(() => {}), warn: vi.spyOn(console, "warn").mockImplementation(() => {}), error: vi.spyOn(console, "error").mockImplementation(() => {}), debug: vi.spyOn(console, "debug").mockImplementation(() => {}) };

beforeEach(() => {
  Object.values(out).forEach((s) => s.mockClear());
  vi.stubEnv("LOG_FORMAT", "json");
  vi.stubEnv("LOG_LEVEL", "info");
  vi.stubEnv("LOG_SERVICE", "web");
});
afterEach(() => {
  vi.unstubAllEnvs();
  setErrorReporter(null);
});

const line = (spy: ReturnType<typeof vi.spyOn>) => JSON.parse(spy.mock.calls.at(-1)![0] as string);

describe("log", () => {
  it("writes one JSON line with level, service, time and the fields", () => {
    log.info("render finished", { videoId: "3f2b8c1e-5d4a-4b6f-9a7e-0c1d2e3f4a5b", ms: 1200 });
    expect(line(out.log)).toMatchObject({ level: "info", service: "web", msg: "render finished", videoId: "3f2b8c1e-5d4a-4b6f-9a7e-0c1d2e3f4a5b", ms: 1200 });
    expect(new Date(line(out.log).time).getTime()).not.toBeNaN();
  });

  it("scrubs the message, the fields and the error", () => {
    log.error("could not email ada@example.com", new Error("smtp said no to bob@example.com"), { quote: "private words", apiKey: "abc" });
    const entry = line(out.error);
    expect(entry.msg).toBe("could not email [email]");
    expect(entry.err).toMatchObject({ name: "Error", message: "smtp said no to [email]" });
    expect(entry.quote).toBe("[text removed: 13 characters]");
    expect(entry.apiKey).toBe("[redacted]");
    expect(JSON.stringify(entry)).not.toMatch(/ada@|bob@|private words/);
  });

  it("takes an error or a fields object as the second argument", () => {
    log.warn("a", { x: 1 });
    expect(line(out.warn)).toMatchObject({ x: 1 });
    expect(line(out.warn).err).toBeUndefined();
    log.warn("b", new Error("boom"));
    expect(line(out.warn).err.message).toBe("boom");
  });

  it("child loggers add their fields to every line", () => {
    const jobLog = log.child({ jobId: "j1" });
    jobLog.info("started", { step: 1 });
    expect(line(out.log)).toMatchObject({ jobId: "j1", step: 1 });
  });

  it("honours LOG_LEVEL, and sends warn and error to their own console methods", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    log.info("quiet");
    log.debug("quieter");
    expect(out.log).not.toHaveBeenCalled();
    log.warn("loud");
    log.error("louder");
    expect(out.warn).toHaveBeenCalledTimes(1);
    expect(out.error).toHaveBeenCalledTimes(1);
    vi.stubEnv("LOG_LEVEL", "silent");
    log.error("nothing");
    expect(out.error).toHaveBeenCalledTimes(1);
  });

  it("prints a readable line outside production", () => {
    vi.stubEnv("LOG_FORMAT", "text");
    log.error("could not save", new Error("disk full"), { id: 7 });
    expect(out.error.mock.calls.at(-1)![0]).toBe('ERROR could not save | disk full {"id":7}');
  });

  it("hands errors, and only errors, to the error reporter, and survives a reporter that throws", () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    log.warn("not an error");
    log.error("this one", new Error("boom"), { id: 1 });
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(reporter.mock.calls[0][1]).toMatchObject({ message: "this one", fields: { id: 1 } });
    setErrorReporter(() => {
      throw new Error("reporter down");
    });
    expect(() => log.error("still fine", new Error("x"))).not.toThrow();
  });

  it("log.error without an error still reports something", () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    log.error("plain message");
    expect((reporter.mock.calls[0][0] as Error).message).toBe("plain message");
  });
});
