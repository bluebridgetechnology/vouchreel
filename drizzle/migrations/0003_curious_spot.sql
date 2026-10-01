CREATE TYPE "public"."incentive_type" AS ENUM('none', 'discount', 'custom');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('none', 'pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."submission_type" AS ENUM('video', 'text');--> statement-breakpoint
ALTER TYPE "public"."platform" ADD VALUE 'text';--> statement-breakpoint
CREATE TABLE "collection_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"title" text NOT NULL,
	"prompt_text" text NOT NULL,
	"incentive_type" "incentive_type" DEFAULT 'none' NOT NULL,
	"incentive_value" text,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_forms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"type" "submission_type" NOT NULL,
	"video_url" text,
	"text" text,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"processing_status" "processing_status" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "testimonials" ALTER COLUMN "video_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_forms" ADD CONSTRAINT "collection_forms_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_form_id_collection_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."collection_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_forms_space_idx" ON "collection_forms" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "submissions_form_status_idx" ON "submissions" USING btree ("form_id","status");