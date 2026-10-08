import { z } from "zod";

/**
 * Zod probes whether it may compile validators with `new Function` (faster) and falls back when the browser refuses.
 * Under our Content Security Policy the browser does refuse, and reports a violation on every page that loads Zod.
 * Telling Zod up front skips the probe and the noise; validation behaves the same (only a little slower, which does not
 * matter for form checks). Imported once by the root client provider.
 */
z.config({ jitless: true });
