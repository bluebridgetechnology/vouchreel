import { z } from "zod";

export const reviewProviderSchema = z.enum(["google", "trustpilot"]);

export const connectReviewSourceSchema = z.object({
  provider: reviewProviderSchema,
  providerBusinessId: z
    .string()
    .trim()
    .min(1, "Place ID or Business Unit ID is required"),
  apiKey: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  syncNow: z.boolean().default(true),
});

export const updateReviewSchema = z.object({
  isApproved: z.boolean(),
});

export type ReviewProvider = z.infer<typeof reviewProviderSchema>;
export type ConnectReviewSourceInput = z.infer<typeof connectReviewSourceSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
