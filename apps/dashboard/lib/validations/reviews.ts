import { z } from "zod";

export const reviewProviderSchema = z.enum(["google", "trustpilot"]);

export const connectReviewSourceSchema = z.object({
  provider: reviewProviderSchema,
  providerBusinessId: z
    .string()
    .trim()
    .min(1, "Place ID or Business Unit ID is required"),
  // The owner's own key for the provider: the platform holds none of its own
  apiKey: z.string().trim().min(1, "Your API key is required"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  syncNow: z.boolean().default(true),
});

export const updateReviewSchema = z.object({
  isApproved: z.boolean(),
});

export type ReviewProvider = z.infer<typeof reviewProviderSchema>;
export type ConnectReviewSourceInput = z.infer<typeof connectReviewSourceSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
