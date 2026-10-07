import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
import { renderPrometheus } from "../metrics";

describe("renderPrometheus", () => {
  it("writes HELP and TYPE lines and one line per sample, with labels", () => {
    const text = renderPrometheus([
      { name: "vouchreel_jobs", help: "Jobs by type and status", type: "gauge", samples: [{ labels: { type: "file_cleanup", status: "queued" }, value: 3 }, { labels: { type: "review_video", status: "failed" }, value: 1 }] },
      { name: "vouchreel_up", help: "up", type: "gauge", samples: [{ value: 1 }] },
    ]);
    expect(text).toBe(
      [
        "# HELP vouchreel_jobs Jobs by type and status",
        "# TYPE vouchreel_jobs gauge",
        'vouchreel_jobs{type="file_cleanup",status="queued"} 3',
        'vouchreel_jobs{type="review_video",status="failed"} 1',
        "# HELP vouchreel_up up",
        "# TYPE vouchreel_up gauge",
        "vouchreel_up 1",
        "",
      ].join("\n")
    );
  });

  it("escapes label values and never prints NaN or Infinity", () => {
    const text = renderPrometheus([{ name: "m", help: "h", type: "gauge", samples: [{ labels: { a: 'x"y\\z\nw' }, value: Number.NaN }, { value: Infinity }] }]);
    expect(text).toContain('m{a="x\\"y\\\\z\\nw"} 0');
    expect(text).toContain("\nm 0\n");
  });
});
