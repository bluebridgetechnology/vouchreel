import { queueFileCleanup } from "@/lib/storage/cleanup";
import { randomUUID } from "crypto";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionForms, submissions } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { ensureFfmpeg, friendlyMediaError, runFfmpeg } from "@/lib/media/ffmpeg";
import { notifySpaceOwner } from "@/lib/notifications/service";

/**
 * Runs in-process in the self-hosted deployment after a video upload. A durable
 * worker can invoke this function for a submission ID if the app is serverless.
 */
export async function transcodeSubmission(submissionId: string) {
  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId));

  if (!submission?.videoUrl || submission.processingStatus !== "pending") return;

  const claimed = await db
    .update(submissions)
    .set({ processingStatus: "processing" })
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.processingStatus, "pending")
      )
    )
    .returning({ id: submissions.id });
  if (!claimed.length) return;

  const directory = await mkdtemp(path.join(tmpdir(), "vouchreel-transcode-"));
  const sourcePath = path.join(directory, "source");
  const outputPath = path.join(directory, "video.mp4");
  const thumbnailPath = path.join(directory, "thumbnail.jpg");

  try {
    // Fail fast with a clear reason instead of downloading a video we cannot process
    await ensureFfmpeg();

    const source = await fetch(submission.videoUrl);
    if (!source.ok) throw new Error(`Unable to download video (${source.status})`);
    const contentLength = Number(source.headers.get("content-length") || 0);
    if (contentLength > 100 * 1024 * 1024) throw new Error("Video exceeds 100 MB limit");
    const bytes = Buffer.from(await source.arrayBuffer());
    if (bytes.byteLength > 100 * 1024 * 1024) throw new Error("Video exceeds 100 MB limit");
    await writeFile(sourcePath, bytes);

    await runFfmpeg([
      "-i", sourcePath,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-vf", "scale='min(1280,iw)':-2",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outputPath,
    ]);
    await runFfmpeg(["-ss", "00:00:01", "-i", outputPath, "-frames:v", "1", "-q:v", "2", thumbnailPath]);

    const storage = getStorage();
    const baseKey = `submissions/${submission.id}/${randomUUID()}`;
    const [videoUrl, thumbnailUrl] = await Promise.all([
      storage.upload(await readFile(outputPath), `${baseKey}.mp4`, {
        contentType: "video/mp4",
        public: true,
      }),
      storage.upload(await readFile(thumbnailPath), `${baseKey}.jpg`, {
        contentType: "image/jpeg",
        public: true,
      }),
    ]);

    await db
      .update(submissions)
      .set({ videoUrl, thumbnailUrl, processingStatus: "done", processingError: null })
      .where(eq(submissions.id, submissionId));

    // The transcoded copy replaced the raw upload, which nothing points at any more: delete it
    await queueFileCleanup([submission.videoUrl]).catch((error) => console.error(`Could not queue cleanup of the raw upload of ${submissionId}:`, error));
  } catch (error) {
    console.error(`Failed to transcode submission ${submissionId}:`, error);
    const reason = friendlyMediaError(error);
    await db
      .update(submissions)
      .set({ processingStatus: "failed", processingError: reason })
      .where(eq(submissions.id, submissionId));

    const [form] = await db
      .select({ spaceId: collectionForms.spaceId })
      .from(collectionForms)
      .where(eq(collectionForms.id, submission.formId));
    if (form) {
      void notifySpaceOwner(form.spaceId, {
        type: "video.processing_failed",
        title: `Video from ${submission.customerName} could not be processed`,
        body: reason,
        href: `/spaces/${form.spaceId}/collect`,
        metadata: { submissionId },
        dedupeKey: `video-failed:${submissionId}`,
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function queueTranscode(submissionId: string) {
  void transcodeSubmission(submissionId);
}
