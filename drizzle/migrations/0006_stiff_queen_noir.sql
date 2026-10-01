CREATE TYPE "public"."export_framing" AS ENUM('blur', 'letterbox');--> statement-breakpoint
CREATE TYPE "public"."social_export_format" AS ENUM('tiktok', 'reels', 'shorts');--> statement-breakpoint
CREATE TYPE "public"."social_export_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."watermark_position" AS ENUM('bottom-right', 'bottom-left', 'top-right', 'top-left');--> statement-breakpoint
CREATE TABLE "social_export_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"logo_url" text,
	"brand_color" text DEFAULT '#6366f1' NOT NULL,
	"watermark_position" "watermark_position" DEFAULT 'bottom-right' NOT NULL,
	"show_watermark" boolean DEFAULT true NOT NULL,
	"default_framing" "export_framing" DEFAULT 'blur' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_export_settings_space_id_unique" UNIQUE("space_id")
);
--> statement-breakpoint
CREATE TABLE "social_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"testimonial_id" uuid NOT NULL,
	"format" "social_export_format" NOT NULL,
	"output_url" text,
	"status" "social_export_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "social_export_settings" ADD CONSTRAINT "social_export_settings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_exports" ADD CONSTRAINT "social_exports_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_exports" ADD CONSTRAINT "social_exports_testimonial_id_testimonials_id_fk" FOREIGN KEY ("testimonial_id") REFERENCES "public"."testimonials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_exports_space_idx" ON "social_exports" USING btree ("space_id","created_at");--> statement-breakpoint
CREATE INDEX "social_exports_testimonial_idx" ON "social_exports" USING btree ("testimonial_id","created_at");