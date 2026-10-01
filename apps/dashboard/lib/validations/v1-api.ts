import { z } from "zod";

const matchRulesSchema = z
  .object({
    mode: z.enum(["all", "url", "tag"]).default("all"),
    urlPatterns: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  })
  .default({ mode: "all", urlPatterns: [], tags: [] });

export const createTestimonialV1Schema = z.object({
  videoUrl: z.string().url("Must be a valid URL").optional().nullable(),
  platform: z.enum(["youtube", "vimeo", "mp4", "text"]).optional(),
  title: z.string().max(255).optional(),
  thumbnailUrl: z.string().url("Must be a valid URL").optional().nullable(),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  quote: z.string().optional().nullable(),
  customerName: z.string().max(255).optional().nullable(),
  customerCompany: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().trim()).default([]),
  matchRules: matchRulesSchema.optional(),
  isActive: z.boolean().default(true),
});

export const updateTestimonialV1Schema = z.object({
  videoUrl: z.string().url("Must be a valid URL").optional().nullable(),
  platform: z.enum(["youtube", "vimeo", "mp4", "text"]).optional(),
  title: z.string().max(255).optional(),
  thumbnailUrl: z.string().url("Must be a valid URL").optional().nullable(),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  quote: z.string().optional().nullable(),
  customerName: z.string().max(255).optional().nullable(),
  customerCompany: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().trim()).optional(),
  matchRules: matchRulesSchema.optional(),
  isActive: z.boolean().optional(),
});

export const paginationV1Schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTestimonialV1Input = z.infer<typeof createTestimonialV1Schema>;
export type UpdateTestimonialV1Input = z.infer<typeof updateTestimonialV1Schema>;
