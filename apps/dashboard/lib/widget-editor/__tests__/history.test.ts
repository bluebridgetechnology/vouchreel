import { describe, expect, it } from "vitest";
import { COALESCE_MS, createHistory, HISTORY_LIMIT, pushHistory, redo, undo } from "../history";

describe("widget editor undo/redo", () => {
  it("undoes and redoes changes in order", () => {
    let h = createHistory("a");
    h = pushHistory(h, "b", "x", 0);
    h = pushHistory(h, "c", "y", 10);
    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(h);
    expect(h.present).toBe("a");
    expect(undo(h)).toBe(h); // nothing further back
    h = redo(h);
    expect(h.present).toBe("b");
  });

  it("a new change after undo drops the redo branch", () => {
    let h = pushHistory(pushHistory(createHistory("a"), "b", "x", 0), "c", "y", 10);
    h = pushHistory(undo(h), "d", "z", 20);
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
    expect(undo(h).present).toBe("b");
  });

  it("one drag of a slider is one undo step", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = pushHistory(h, i, "radius", i * 50);
    expect(h.present).toBe(10);
    expect(undo(h).present).toBe(0);
  });

  it("the same control after a pause, or another control, is a new step", () => {
    let h = createHistory(0);
    h = pushHistory(h, 1, "radius", 0);
    h = pushHistory(h, 2, "radius", COALESCE_MS + 1);
    h = pushHistory(h, 3, "colour", COALESCE_MS + 2);
    expect(undo(h).present).toBe(2);
    expect(undo(undo(h)).present).toBe(1);
  });

  it("keeps at most the last steps", () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) h = pushHistory(h, i, `k${i}`, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });

  it("ignores a change to the same value", () => {
    const h = createHistory("a");
    expect(pushHistory(h, "a", "x")).toBe(h);
  });
});
