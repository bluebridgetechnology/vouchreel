import { z } from "zod";

/** The most the bar can say: it is one line across the top of every marketing page. */
export const ANNOUNCEMENT_MESSAGE_MAX = 160;
export const ANNOUNCEMENT_LINK_TEXT_MAX = 40;
export const ANNOUNCEMENT_LINK_TEXT_DEFAULT = "Learn more";

/**
 * A link the bar may use: a path on this site ("/pricing", "/#faq") or a full http(s) address. Anything else, such as
 * "javascript:" or "//other.example", is refused, since the admin types it and every visitor would be sent there.
 */
export function isSafeAnnouncementLink(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("\\");
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** True for a link that stays on this site, so it opens in the same tab. */
export const isInternalLink = (value: string) => value.startsWith("/");

export const announcementSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().max(ANNOUNCEMENT_MESSAGE_MAX, `Keep it to ${ANNOUNCEMENT_MESSAGE_MAX} characters`),
    linkText: z.string().trim().max(ANNOUNCEMENT_LINK_TEXT_MAX, `Keep it to ${ANNOUNCEMENT_LINK_TEXT_MAX} characters`),
    linkUrl: z.string().trim().max(500),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && !value.message) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Write the announcement before turning it on" });
    }
    if (value.linkUrl && !isSafeAnnouncementLink(value.linkUrl)) {
      ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Use a path such as /pricing, or a full https:// address" });
    }
  });

export type Announcement = z.infer<typeof announcementSchema>;

export const EMPTY_ANNOUNCEMENT: Announcement = { enabled: false, message: "", linkText: "", linkUrl: "" };
