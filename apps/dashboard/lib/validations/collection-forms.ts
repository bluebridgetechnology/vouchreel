import { z } from "zod";

export const collectionFormBrandingSchema = z.object({
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Accent color must be a hex color like #cf3d0b")
    .optional(),
  logoUrl: z
    .string()
    .url("Logo must be a valid URL")
    .optional()
    .or(z.literal("")),
});

export type CollectionFormBrandingInput = z.infer<
  typeof collectionFormBrandingSchema
>;

const incentiveRefinement = (data: {
  incentiveType: "none" | "discount" | "custom";
  incentiveValue?: string | null;
}) =>
  data.incentiveType === "none" ||
  (typeof data.incentiveValue === "string" && data.incentiveValue.length > 0);

export const createCollectionFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    promptText: z
      .string()
      .trim()
      .min(1, "Prompt text is required")
      .max(1000),
    incentiveType: z.enum(["none", "discount", "custom"]).default("none"),
    incentiveValue: z.string().trim().max(500).optional().nullable(),
    branding: collectionFormBrandingSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(incentiveRefinement, {
    message: "Incentive value is required when an incentive type is selected",
    path: ["incentiveValue"],
  });

export const updateCollectionFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120).optional(),
    promptText: z.string().trim().min(1, "Prompt text is required").max(1000).optional(),
    incentiveType: z.enum(["none", "discount", "custom"]).optional(),
    incentiveValue: z.string().trim().max(500).optional().nullable(),
    branding: collectionFormBrandingSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.incentiveType && !incentiveRefinement({ incentiveType: data.incentiveType, incentiveValue: data.incentiveValue })) {
      ctx.addIssue({ code: "custom", message: "Incentive value is required when an incentive type is selected", path: ["incentiveValue"] });
    }
  });

export const updateSubmissionStatusSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

// Public submission metadata (sent alongside video uploads or with text submissions)
export const submissionMetaSchema = z.object({
  customerName: z.string().trim().min(1, "Name is required").max(100),
  customerEmail: z.email("A valid email is required").max(200),
  text: z.string().trim().min(1, "Testimonial text is required").max(5000).optional(),
  durationSeconds: z.number().int().min(0).max(600).optional().nullable(),
  /** Only meaningful for written testimonials; the route ignores it for video. */
  aiVideoConsent: z.boolean().optional(),
});

export type CreateCollectionFormInput = z.infer<
  typeof createCollectionFormSchema
>;
export type UpdateCollectionFormInput = z.infer<
  typeof updateCollectionFormSchema
>;
export type SubmissionMetaInput = z.infer<typeof submissionMetaSchema>;
