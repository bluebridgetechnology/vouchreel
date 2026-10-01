import { z } from "zod";

export const watermarkPositionSchema = z.enum([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
]);

export const exportFramingSchema = z.enum(["blur", "letterbox"]);

export const socialExportFormatSchema = z.enum(["tiktok", "reels", "shorts"]);

export const updateSocialExportSettingsSchema = z.object({
  logoUrl: z
    .string()
    .url("Logo must be a valid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Brand color must be a valid hex color like #cf3d0b")
    .optional(),
  watermarkPosition: watermarkPositionSchema.optional(),
  showWatermark: z.boolean().optional(),
  defaultFraming: exportFramingSchema.optional(),
});

export type UpdateSocialExportSettingsInput = z.infer<
  typeof updateSocialExportSettingsSchema
>;

export const createSocialExportSchema = z.object({
  format: socialExportFormatSchema,
  framing: exportFramingSchema.optional(),
  includeCaptions: z.boolean().optional().default(true),
  includeBranding: z.boolean().optional().default(true),
  watermarkPosition: watermarkPositionSchema.optional(),
  durationSeconds: z.number().int().positive().max(180).optional(),
});

export type CreateSocialExportInput = z.infer<typeof createSocialExportSchema>;
