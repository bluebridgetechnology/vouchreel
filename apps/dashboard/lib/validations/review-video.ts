import { z } from "zod";

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
  /** The owner confirms they may use these reviews in their marketing. */
  rightsConfirmed: z.boolean(),
});
