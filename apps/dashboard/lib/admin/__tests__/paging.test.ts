import { describe, expect, it, vi } from "vitest";
import { clampedPage, lastPage } from "../paging";

const fake = (total: number, pageSize: number) =>
  vi.fn(async (page: number) => ({ total, page, items: page }));

describe("clampedPage", () => {
  it("computes the last page, 1 when empty", () => {
    expect(lastPage(0, 25)).toBe(1);
    expect(lastPage(25, 25)).toBe(1);
    expect(lastPage(26, 25)).toBe(2);
  });
  it("returns a page inside the range as it is, with one query", async () => {
    const run = fake(60, 25);
    expect((await clampedPage(run, 2, 25)).page).toBe(2);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("re-runs for the last page when the page is past the end", async () => {
    const run = fake(60, 25);
    const result = await clampedPage(run, 99, 25);
    expect(result.page).toBe(3);
    expect(run.mock.calls.map((c) => c[0])).toEqual([99, 3]);
  });
  it("an empty result stays on page 1", async () => {
    const run = fake(0, 25);
    expect((await clampedPage(run, 7, 25)).page).toBe(1);
  });
});
