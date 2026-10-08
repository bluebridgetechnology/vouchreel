/**
 * Undo/redo for the widget editor. Pure, so it is tested without React.
 *
 * Dragging a slider or typing a colour fires a change per pixel or keystroke; changes that share a key and
 * arrive within `COALESCE_MS` of each other become one step, so one undo undoes the whole drag.
 */

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Key and time of the last change, for coalescing. */
  lastKey?: string;
  lastAt?: number;
}

export const HISTORY_LIMIT = 50;
export const COALESCE_MS = 800;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function pushHistory<T>(h: History<T>, next: T, key?: string, now = Date.now()): History<T> {
  if (next === h.present) return h;
  const coalesce = key !== undefined && key === h.lastKey && h.lastAt !== undefined && now - h.lastAt < COALESCE_MS;
  if (coalesce) return { ...h, present: next, future: [], lastAt: now };
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
