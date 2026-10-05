export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

export interface JobHandlerOptions {
  /** Called once when the job has failed for good (no attempts left), so state can be settled. */
  onFailed?: (payload: Record<string, unknown>, error: unknown) => Promise<void>;
}

const handlers = new Map<string, { run: JobHandler } & JobHandlerOptions>();

export function registerJobHandler(type: string, handler: JobHandler, options: JobHandlerOptions = {}): void {
  handlers.set(type, { run: handler, ...options });
}

export function getJobHandler(type: string): JobHandler | undefined {
  return handlers.get(type)?.run;
}

export function getJobFailureHandler(type: string): JobHandlerOptions["onFailed"] {
  return handlers.get(type)?.onFailed;
}

export const JOB_TYPES = {
  socialExport: "social_export",
  aiVideo: "ai_video",
} as const;

let registered = false;

/** Registers every built-in handler. Imported lazily so the web bundle does not pull in ffmpeg code. */
export async function registerBuiltInHandlers(): Promise<void> {
  if (registered) return;
  registered = true;
  const { renderSocialExport } = await import("@/lib/social/pipeline");
  registerJobHandler(JOB_TYPES.socialExport, async (payload) => {
    const exportId = payload.exportId;
    if (typeof exportId !== "string") throw new Error("social_export job missing exportId");
    await renderSocialExport(exportId);
  });
  const { registerAiVideoHandler } = await import("@/lib/ai-video/render");
  registerAiVideoHandler();
}
