import { z } from "zod";

export const createAiVideoSchema = z.object({
  template: z.string().trim().min(1).max(40),
  voice: z.string().trim().min(1).max(40),
  aspect: z.enum(["9:16", "16:9"]).default("9:16"),
  language: z.string().trim().min(2).max(20).optional(),
});

export const reviewAiVideoSchema = z.object({
  action: z.literal("approve"),
  /** Owner-edited script; may only remove words from the customer's text. */
  script: z.string().trim().min(1).max(2000).optional(),
});
