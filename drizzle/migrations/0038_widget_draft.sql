ALTER TABLE "widget_configs" ADD COLUMN "draft_config" jsonb;--> statement-breakpoint
ALTER TABLE "widget_configs" ADD COLUMN "published_at" timestamp with time zone;