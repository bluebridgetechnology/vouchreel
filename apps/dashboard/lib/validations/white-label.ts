import { z } from "zod";

export const whiteLabelSettingsSchema = z.object({
  logoUrl: z.string().url("Must be a valid URL").nullable().optional(),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/,
      "Must be a valid domain or subdomain (e.g. reviews.yourbrand.com)"
    )
    .nullable()
    .optional()
    .or(z.literal("")),
  cnameVerified: z.boolean().optional(),
  removeBranding: z.boolean().optional(),
  customEmailSender: z
    .string()
    .trim()
    .max(100, "Sender name / email must be under 100 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
});

export type WhiteLabelSettingsInput = z.infer<typeof whiteLabelSettingsSchema>;
