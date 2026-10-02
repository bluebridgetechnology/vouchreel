export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function getJobHandler(type: string): JobHandler | undefined {
  return handlers.get(type);
}

export const JOB_TYPES = {
  socialExport: "social_export",
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
}
