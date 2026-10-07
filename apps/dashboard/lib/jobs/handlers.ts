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
  /** Rendered by the video worker only (needs Chromium); see lib/jobs/main-video.ts. */
  reviewVideo: "review_video",
  /** Deletes stored files after the rows that owned them were deleted; see lib/storage/cleanup.ts. */
  fileCleanup: "file_cleanup",
  /** Builds a "download my data" zip; see lib/account/export.ts. */
  dataExport: "data_export",
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
  const { runFileCleanup } = await import("@/lib/storage/cleanup");
  registerJobHandler(JOB_TYPES.fileCleanup, async (payload) => {
    const keys = payload.keys;
    if (!Array.isArray(keys) || !keys.every((k) => typeof k === "string")) throw new Error("file_cleanup job missing keys");
    await runFileCleanup(keys as string[]);
  });
  const { runExport, failExport } = await import("@/lib/account/export");
  registerJobHandler(
    JOB_TYPES.dataExport,
    async (payload) => {
      if (typeof payload.exportId !== "string") throw new Error("data_export job missing exportId");
      await runExport(payload.exportId);
    },
    { onFailed: async (payload, error) => { if (typeof payload.exportId === "string") await failExport(payload.exportId, error); } }
  );
  const { registerAiVideoHandler } = await import("@/lib/ai-video/render");
  registerAiVideoHandler();
}
