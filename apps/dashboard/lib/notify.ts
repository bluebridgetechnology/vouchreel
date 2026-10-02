import { toast } from "sonner";

/**
 * App-wide feedback. Use these instead of alert(), inline success banners or
 * ad-hoc state. Errors from fetch/catch blocks: `notify.fromError(err, "Fallback")`.
 *
 *   notify.success("Saved");
 *   notify.promise(save(), { loading: "Saving…", success: "Saved", error: "Could not save" });
 */
type Options = { description?: string; duration?: number; id?: string | number };

export const notify = {
  success: (message: string, options?: Options) => toast.success(message, options),
  error: (message: string, options?: Options) => toast.error(message, { duration: 7000, ...options }),
  warning: (message: string, options?: Options) => toast.warning(message, options),
  info: (message: string, options?: Options) => toast.info(message, options),
  /** Toast for a caught value: uses Error.message when present, else the fallback. */
  fromError: (error: unknown, fallback: string, options?: Options) =>
    toast.error(error instanceof Error && error.message ? error.message : fallback, { duration: 7000, ...options }),
  promise: toast.promise,
  dismiss: toast.dismiss,
};
