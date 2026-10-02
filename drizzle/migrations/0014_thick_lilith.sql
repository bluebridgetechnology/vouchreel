CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "badge" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "limits" jsonb;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "is_custom" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_idx" ON "admin_audit_log" USING btree ("created_at");
--> statement-breakpoint
-- Backfill DB-backed entitlements for existing 'free' plans (-1 = unlimited)
UPDATE "plans" SET "limits" = '{"tier": "free", "maxSpaces": 1, "maxTestimonialsPerSpace": 3, "removeWatermark": false, "canCustomizeBranding": false, "canUseAllTriggers": false, "canAccessAnalytics": false, "canUseCustomRules": false, "multiSeat": false, "whiteLabel": false, "exportableReports": false}'::jsonb, "sort_order" = 0, "description" = COALESCE("description", 'Perfect for side projects and evaluating Vouchreel.') WHERE lower("name") = 'free' AND "limits" IS NULL;
--> statement-breakpoint
-- Backfill DB-backed entitlements for existing 'pro' plans (-1 = unlimited)
UPDATE "plans" SET "limits" = '{"tier": "pro", "maxSpaces": 5, "maxTestimonialsPerSpace": -1, "removeWatermark": true, "canCustomizeBranding": true, "canUseAllTriggers": true, "canAccessAnalytics": true, "canUseCustomRules": true, "multiSeat": false, "whiteLabel": false, "exportableReports": true}'::jsonb, "sort_order" = 10, "description" = COALESCE("description", 'Everything you need to collect and showcase high-converting videos.'), "badge" = COALESCE("badge", 'Most popular') WHERE lower("name") = 'pro' AND "limits" IS NULL;
--> statement-breakpoint
-- Backfill DB-backed entitlements for existing 'agency' plans (-1 = unlimited)
UPDATE "plans" SET "limits" = '{"tier": "agency", "maxSpaces": -1, "maxTestimonialsPerSpace": -1, "removeWatermark": true, "canCustomizeBranding": true, "canUseAllTriggers": true, "canAccessAnalytics": true, "canUseCustomRules": true, "multiSeat": true, "whiteLabel": true, "exportableReports": true}'::jsonb, "sort_order" = 20, "description" = COALESCE("description", 'For agencies and teams managing multiple client brands with white-label proof.') WHERE lower("name") = 'agency' AND "limits" IS NULL;
--> statement-breakpoint
-- Backfill DB-backed entitlements for existing 'business' plans (-1 = unlimited)
UPDATE "plans" SET "limits" = '{"tier": "business", "maxSpaces": -1, "maxTestimonialsPerSpace": -1, "removeWatermark": true, "canCustomizeBranding": true, "canUseAllTriggers": true, "canAccessAnalytics": true, "canUseCustomRules": true, "multiSeat": true, "whiteLabel": true, "exportableReports": true}'::jsonb, "sort_order" = 30, "description" = COALESCE("description", 'For fast-growing companies and agencies demanding maximum power.') WHERE lower("name") = 'business' AND "limits" IS NULL;
