import { z } from "zod";

export const createConversionGoalSchema = z.discriminatedUnion("goalType", [
  z.object({
    goalType: z.literal("url-match"),
    goalValue: z
      .string()
      .trim()
      .min(1, "Goal URL pattern is required")
      .max(500, "Goal URL pattern is too long")
      .startsWith("/", "Goal URL must be a path like /thank-you"),
  }),
  z.object({
    goalType: z.literal("pixel"),
    goalValue: z
      .string()
      .trim()
      .min(1, "Goal name is required")
      .max(200, "Goal name is too long"),
  }),
]);

export type CreateConversionGoalInput = z.infer<typeof createConversionGoalSchema>;
