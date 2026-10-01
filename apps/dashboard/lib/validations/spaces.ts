import { z } from "zod";

export const createSpaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Space name cannot be empty")
    .max(100, "Space name must be 100 characters or less"),
});

export const updateSpaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Space name cannot be empty")
    .max(100, "Space name must be 100 characters or less"),
});

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;
