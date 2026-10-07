import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { generatedVideos, spaces, testimonialConsents, testimonials } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/transport";
import { renderEmail } from "@/lib/email/templates";
import { notifySpaceOwner } from "@/lib/notifications/service";
import { getStorage } from "@/lib/storage";
import { keysFromUrls, queueFileCleanup } from "@/lib/storage/cleanup";
import { log } from "@/lib/log";

/**
 * A customer withdrawing the agreement they gave to AI video. Withdrawal is recorded on the consent,
 * every video made under it is removed (its file deleted, its owner told why), videos still being
 * made are stopped, and no new video can be made without fresh consent.
 */

export const WITHDRAWN_REASON = "The customer withdrew their consent to AI video.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is required to sign consent links");
  return value;
}

const sign = (consentId: string) => createHmac("sha256", secret()).update(`ai-video-consent:${consentId}`).digest("hex");

/** A link token that proves the holder was given this consent's link. It does not expire: withdrawal must always be possible. */
export function consentToken(consentId: string): string {
  return `${consentId}.${sign(consentId)}`;
}

/** The consent id inside a valid token, or null for a malformed or forged one. */
export function consentIdFromToken(token: string): string | null {
  const [id, signature, extra] = token.split(".");
  if (!id || !signature || extra !== undefined || !UUID.test(id)) return null;
  const expected = Buffer.from(sign(id), "hex");
  const given = Buffer.from(signature, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return id;
}

export function withdrawalUrl(consentId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/consent/withdraw?token=${consentToken(consentId)}`;
}

export interface WithdrawalResult {
  status: "withdrawn" | "already_withdrawn" | "not_found";
  /** Finished videos whose file was removed. */
  removedVideos: number;
  /** Videos that were still being made and were stopped. */
  stoppedVideos: number;
}

export async function withdrawConsent(consentId: string, by: "customer" | "owner"): Promise<WithdrawalResult> {
  const outcome = await db.transaction(async (tx) => {
    const [consent] = await tx.select().from(testimonialConsents).where(eq(testimonialConsents.id, consentId));
    if (!consent) return { status: "not_found" as const, urls: [] as string[], removed: 0, stopped: 0, spaceId: "" };
    if (consent.revokedAt) return { status: "already_withdrawn" as const, urls: [], removed: 0, stopped: 0, spaceId: consent.spaceId };

    await tx.update(testimonialConsents).set({ revokedAt: new Date() }).where(eq(testimonialConsents.id, consentId));

    const videos = await tx.select().from(generatedVideos).where(eq(generatedVideos.consentId, consentId));
    const finished = videos.filter((v) => v.status === "done" && v.outputUrl && !v.moderatedAt);
    const unfinished = videos.filter((v) => v.status === "draft" || v.status === "queued" || v.status === "rendering");
    const urls = finished.map((v) => v.outputUrl as string);

    if (finished.length) {
      await tx
        .update(generatedVideos)
        .set({ outputUrl: null, moderatedAt: new Date(), moderatedBy: null, moderationReason: WITHDRAWN_REASON })
        .where(inArray(generatedVideos.id, finished.map((v) => v.id)));
    }
    if (unfinished.length) {
      // Failed videos do not hold a credit, so stopping one gives the credit back
      await tx
        .update(generatedVideos)
        .set({ status: "failed", error: WITHDRAWN_REASON, completedAt: new Date() })
        .where(inArray(generatedVideos.id, unfinished.map((v) => v.id)));
    }
    // Durable: if deleting right now fails, a worker finishes the job
    await queueFileCleanup(urls, tx);
    return { status: "withdrawn" as const, urls, removed: finished.length, stopped: unfinished.length, spaceId: consent.spaceId };
  });

  if (outcome.status !== "withdrawn") return { status: outcome.status, removedVideos: 0, stoppedVideos: 0 };

  // Take the files down now rather than waiting for the worker; a failure is left to the queued job
  const storage = getStorage();
  await Promise.allSettled(keysFromUrls(outcome.urls).map((key) => storage.delete(key)));

  void notifySpaceOwner(outcome.spaceId, {
    type: "consent.withdrawn",
    title: by === "customer" ? "A customer withdrew their AI video consent" : "AI video consent recorded as withdrawn",
    body:
      outcome.removed > 0
        ? `${outcome.removed} video${outcome.removed === 1 ? " was" : "s were"} removed. No new AI video can be made from that testimonial.`
        : "No new AI video can be made from that testimonial.",
    href: `/spaces/${outcome.spaceId}/testimonials`,
    metadata: { consentId, by },
  });
  return { status: "withdrawn", removedVideos: outcome.removed, stoppedVideos: outcome.stopped };
}

/** What the public withdrawal page shows about a consent. Null when there is no such consent. */
export async function describeConsent(consentId: string) {
  const [row] = await db
    .select({
      grantedAt: testimonialConsents.grantedAt,
      revokedAt: testimonialConsents.revokedAt,
      customerName: testimonials.customerName,
      spaceName: spaces.name,
    })
    .from(testimonialConsents)
    .innerJoin(testimonials, eq(testimonialConsents.testimonialId, testimonials.id))
    .innerJoin(spaces, eq(testimonialConsents.spaceId, spaces.id))
    .where(eq(testimonialConsents.id, consentId));
  return row ?? null;
}

/** Tells the customer what they agreed to, and how to withdraw. Best effort: never throws. */
export async function sendConsentReceipt(params: { consentId: string; to: string; name: string; spaceName: string }): Promise<void> {
  try {
    const url = withdrawalUrl(params.consentId);
    const title = `You agreed to an AI video of your testimonial for ${params.spaceName}`;
    const body =
      `Hi ${params.name}, when you wrote your testimonial you agreed that ${params.spaceName} may turn it into a short video with an AI-generated voiceover. ` +
      "Your words will not be changed in meaning, no likeness or voice of yours is created, and the video is labelled as AI-generated. " +
      "You can withdraw this agreement at any time: the video is removed and no new one is made.";
    const { html } = renderEmail({ title, body, cta: { label: "Withdraw my agreement", url }, footer: "If you are happy for this to go ahead, you do not need to do anything." });
    await sendEmail({ to: params.to, subject: title, text: `${body}\n\nWithdraw: ${url}`, html });
  } catch (error) {
    log.error("[consent] could not send the consent receipt:", error);
  }
}
