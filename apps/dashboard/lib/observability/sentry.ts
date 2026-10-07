import * as Sentry from "@sentry/node";
import { setErrorReporter } from "@/lib/log";
import { scrubSentryEvent, scrubValue } from "./scrub";

/**
 * Error tracking. Off unless SENTRY_DSN is set, so a self-hosted install, tests and development send
 * nothing anywhere. Any Sentry-compatible server works (Sentry, GlitchTip). Every event is scrubbed
 * (lib/observability/scrub) before it leaves the process.
 *
 *   SENTRY_DSN          where to send; unset = off
 *   SENTRY_ENVIRONMENT  defaults to NODE_ENV
 *   SENTRY_RELEASE      e.g. the git commit
 */

export type Service = "web" | "worker" | "video-worker";

export interface InitOptions {
  /** For tests: receives every envelope instead of the network. */
  transport?: NonNullable<Parameters<typeof Sentry.init>[0]>["transport"];
  dsn?: string;
}

let started = false;

/** Returns whether error tracking is on. Safe to call more than once. */
export function initObservability(service: Service, options: InitOptions = {}): boolean {
  process.env.LOG_SERVICE ??= service;
  const dsn = options.dsn ?? process.env.SENTRY_DSN;
  if (!dsn) return false;
  if (started) return true;
  started = true;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    // Errors only: no performance traces, no personal data by default
    tracesSampleRate: 0,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubSentryEvent({ breadcrumbs: [breadcrumb] }).breadcrumbs[0],
    initialScope: { tags: { service } },
    ...(options.transport ? { transport: options.transport } : {}),
  });

  // log.error(...) reaches the tracker too, with its fields (scrubbed again by beforeSend)
  setErrorReporter((error, { message, fields }) => {
    Sentry.captureException(error, { extra: { message, ...(scrubValue(fields) as Record<string, unknown>) } });
  });
  return true;
}

/** Sends what is waiting; call before a process exits. */
export async function flushObservability(timeoutMs = 2000): Promise<void> {
  if (started) await Sentry.flush(timeoutMs);
}

/** For Next's `onRequestError`: reports an error thrown while serving a request, with the route and no body. */
export function captureRequestError(error: unknown, request: { path: string; method: string }, context: { routePath?: string; routeType?: string; routerKind?: string }) {
  if (!started) return;
  Sentry.captureException(error, {
    tags: { routePath: context.routePath, routeType: context.routeType, routerKind: context.routerKind },
    extra: { method: request.method, path: scrubPath(request.path) },
  });
}

const scrubPath = (path: string) => path.split("?")[0];

/** Test helper: forget the setup so a test can start again. */
export async function resetObservabilityForTests() {
  if (started) await Sentry.close(0);
  started = false;
  setErrorReporter(null);
}
