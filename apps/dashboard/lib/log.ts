import { scrubString, scrubValue, serializeError } from "@/lib/observability/scrub";

/**
 * Structured logger. One line per event, personal data and secrets removed (lib/observability/scrub).
 *
 *   log.info("render finished", { videoId, ms });
 *   log.error("could not delete file", error);                 // an Error as the second argument
 *   log.error("could not delete file", error, { videoId });    // or with extra fields
 *   const jobLog = log.child({ jobId });                       // fields added to every line
 *
 * Production (or LOG_FORMAT=json) prints JSON; development prints a readable line. LOG_LEVEL picks the
 * lowest level shown (debug, info, warn, error, silent). Errors are also handed to the error tracker
 * when one is configured (lib/observability/sentry).
 */

export type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level | "silent", number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

type Fields = Record<string, unknown>;
export type ErrorReporter = (error: unknown, context: { message: string; fields: Fields }) => void;

let reporter: ErrorReporter | null = null;
/** Called once by the error tracker's setup. */
export function setErrorReporter(next: ErrorReporter | null) {
  reporter = next;
}

const threshold = () => ORDER[(process.env.LOG_LEVEL as Level | "silent" | undefined) ?? "info"] ?? ORDER.info;
const asJson = () => process.env.LOG_FORMAT === "json" || (process.env.LOG_FORMAT !== "text" && process.env.NODE_ENV === "production");
const service = () => process.env.LOG_SERVICE || "web";

const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Error);

function write(level: Level, message: string, second: unknown, third: Fields | undefined, base: Fields) {
  if (ORDER[level] < threshold()) return;

  // The second argument is an error or a fields object; a third may carry fields next to an error
  const error = second !== undefined && !isFields(second) ? second : undefined;
  const fields: Fields = { ...base, ...(isFields(second) ? second : {}), ...(third ?? {}) };

  const safeFields = scrubValue(fields) as Fields;
  const entry: Fields = {
    time: new Date().toISOString(),
    level,
    service: service(),
    msg: scrubString(message),
    ...safeFields,
    ...(error !== undefined ? { err: error instanceof Error ? serializeError(error) : scrubValue(error) } : {}),
  };

  const line = asJson()
    ? JSON.stringify(entry)
    : `${level.toUpperCase().padEnd(5)} ${entry.msg}${error !== undefined ? ` | ${error instanceof Error ? scrubString(error.message) : String(scrubValue(error))}` : ""}${
        Object.keys(safeFields).length ? ` ${JSON.stringify(safeFields)}` : ""
      }`;

  // The console methods keep tests, hosting platforms and the browser-free runtimes all working as before
  (level === "error" ? console.error : level === "warn" ? console.warn : level === "debug" ? console.debug : console.log)(line);

  if (level === "error" && reporter) {
    try {
      reporter(error ?? new Error(message), { message, fields });
    } catch {
      // Reporting must never break the code that is reporting a problem
    }
  }
}

export interface Logger {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, errorOrFields?: unknown, fields?: Fields): void;
  error(message: string, errorOrFields?: unknown, fields?: Fields): void;
  child(fields: Fields): Logger;
}

function make(base: Fields): Logger {
  return {
    debug: (m, f) => write("debug", m, f, undefined, base),
    info: (m, f) => write("info", m, f, undefined, base),
    warn: (m, e, f) => write("warn", m, e, f, base),
    error: (m, e, f) => write("error", m, e, f, base),
    child: (fields) => make({ ...base, ...fields }),
  };
}

export const log: Logger = make({});
