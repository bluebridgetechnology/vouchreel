ALTER TABLE "widget_configs" DROP CONSTRAINT "widget_configs_space_id_unique";--> statement-breakpoint
ALTER TABLE "widget_configs" ADD COLUMN "name" text DEFAULT 'Default widget' NOT NULL;--> statement-breakpoint
ALTER TABLE "widget_configs" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "widget_configs" ADD COLUMN "is_live" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "widget_configs_space_idx" ON "widget_configs" USING btree ("space_id","sort_order","created_at");