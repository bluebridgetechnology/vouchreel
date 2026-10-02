"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and the hydration pass, true once React is interactive.
 *
 * Forms that carry secrets use it to keep their submit button disabled until the
 * onSubmit handler is attached. Before that, pressing Enter or clicking submit performs
 * the browser's native GET and puts the password in the URL (history, logs, Referer).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
