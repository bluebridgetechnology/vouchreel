import { z } from "zod";

export const matchRulesSchema = z.object({
  mode: z.enum(["all", "specific"]).default("all"),
  urlPatterns: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type MatchRules = z.infer<typeof matchRulesSchema>;

export const createTestimonialSchema = z.object({
  videoUrl: z
    .string()
    .url("A valid video URL is required"),
  platform: z.enum(["youtube", "vimeo", "mp4"]).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  quote: z.string().trim().max(2000).optional().nullable(),
  customerName: z.string().trim().max(100).optional().nullable(),
  customerCompany: z.string().trim().max(100).optional().nullable(),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  matchRules: matchRulesSchema.optional(),
});

export const updateTestimonialSchema = z.object({
  videoUrl: z.string().url("A valid video URL is required").optional(),
  platform: z.enum(["youtube", "vimeo", "mp4"]).optional(),
  title: z.string().trim().min(1).max(255).optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable().or(z.literal("")),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  quote: z.string().trim().max(2000).optional().nullable(),
  customerName: z.string().trim().max(100).optional().nullable(),
  customerCompany: z.string().trim().max(100).optional().nullable(),
  tags: z.array(z.string().trim().min(1)).optional(),
  matchRules: matchRulesSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const reorderItemSchema = z.object({
  id: z.string().min(1, "Testimonial ID is required"),
  sortOrder: z.number().int("sortOrder must be an integer"),
});

export const reorderTestimonialsSchema = z
  .object({
    items: z.array(reorderItemSchema).min(1, "At least one item is required"),
  })
  .or(z.array(reorderItemSchema).min(1, "At least one item is required"));

export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;
export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>;
export type ReorderItem = z.infer<typeof reorderItemSchema>;
