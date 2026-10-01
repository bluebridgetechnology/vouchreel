import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "API key name is required")
    .max(100, "Name must be 100 characters or fewer")
    .trim(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
