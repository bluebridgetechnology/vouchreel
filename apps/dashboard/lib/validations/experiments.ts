import { z } from "zod";

export const EXPERIMENT_TYPES = ["trigger", "position", "template"] as const;
export const EXPERIMENT_STATUSES = ["draft", "running", "completed"] as const;

export const experimentTypeSchema = z.enum(EXPERIMENT_TYPES);
export const experimentStatusSchema = z.enum(EXPERIMENT_STATUSES);

export const experimentVariantSchema = z.object({
  id: z.string().min(1, "Variant ID is required"),
  name: z.string().trim().min(1, "Variant name is required"),
  config: z.record(z.string(), z.unknown()),
});

export const createExperimentSchema = z
  .object({
    name: z.string().trim().min(1, "Experiment name is required"),
    type: experimentTypeSchema,
    variants: z
      .array(experimentVariantSchema)
      .min(2, "At least 2 variants are required for an experiment"),
    trafficSplit: z
      .array(z.number().min(0).max(100))
      .min(2, "Traffic split is required for all variants"),
  })
  .superRefine((data, ctx) => {
    if (data.variants.length !== data.trafficSplit.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Number of traffic split entries must match number of variants",
        path: ["trafficSplit"],
      });
      return;
    }

    const sum = data.trafficSplit.reduce((acc, curr) => acc + curr, 0);
    if (Math.abs(sum - 100) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Traffic split percentages must sum up to 100",
        path: ["trafficSplit"],
      });
    }
  });

export const updateExperimentStatusSchema = z.object({
  status: experimentStatusSchema,
});

export const applyWinnerSchema = z.object({
  variantIndex: z.number().int().min(0).optional(),
  variantId: z.string().optional(),
}).refine((data) => data.variantIndex !== undefined || Boolean(data.variantId), {
  message: "Either variantIndex or variantId is required",
});

export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;
export type UpdateExperimentStatusInput = z.infer<typeof updateExperimentStatusSchema>;
export type ApplyWinnerInput = z.infer<typeof applyWinnerSchema>;
