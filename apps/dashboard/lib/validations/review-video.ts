import { z } from "zod";
import { BACKGROUND_STYLES, VIDEO_FONT_IDS, type VideoFontId } from "@vouchreel/video";

export const createReviewVideoSchema = z.object({
  template: z.string().trim().min(1).max(40),
  aspect: z.enum(["9:16", "16:9"]).default("9:16"),
  /** In the order they should appear. */
  reviewIds: z.array(z.uuid()).min(1).max(5),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Brand colour must be a hex colour like #cf3d0b")
    .optional(),
  /** Background style for this video; omit to use the brand kit's default. */
  style: z.enum(BACKGROUND_STYLES).optional(),
  /** Font for this video; omit to use the brand kit's default. */
  font: z.enum(VIDEO_FONT_IDS as [VideoFontId, ...VideoFontId[]]).optional(),
  /** Second colour for this video; omit to use the brand kit's, null for none. */
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Second colour must be a hex colour like #1d4ed8")
    .nullable()
    .optional(),
  /** The owner confirms they may use these reviews in their marketing. */
  rightsConfirmed: z.boolean(),
});
