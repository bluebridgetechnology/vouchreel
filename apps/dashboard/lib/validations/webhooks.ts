import { z } from "zod";

export const WEBHOOK_EVENTS = [
  "testimonial.created",
  "testimonial.updated",
  "testimonial.deleted",
  "submission.received",
  "submission.approved",
  "conversion.tracked",
] as const;

export const WEBHOOK_FORMATS = ["json", "slack"] as const;

export const createWebhookEndpointSchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .refine(
      (val) => val.startsWith("https://") || val.startsWith("http://localhost"),
      "Webhook URL must use HTTPS (http://localhost is permitted for development)"
    ),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, "Select at least one event type"),
  /** "slack" posts a readable message for a Slack incoming webhook. Default "json". */
  format: z.enum(WEBHOOK_FORMATS).default("json"),
});

export const updateWebhookEndpointSchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .refine(
      (val) => val.startsWith("https://") || val.startsWith("http://localhost"),
      "Webhook URL must use HTTPS"
    )
    .optional(),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, "Select at least one event type")
    .optional(),
  isActive: z.boolean().optional(),
  format: z.enum(WEBHOOK_FORMATS).optional(),
});

export type CreateWebhookEndpointInput = z.infer<
  typeof createWebhookEndpointSchema
>;
export type UpdateWebhookEndpointInput = z.infer<
  typeof updateWebhookEndpointSchema
>;
