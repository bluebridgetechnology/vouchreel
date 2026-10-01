CREATE TYPE "public"."experiment_status" AS ENUM('draft', 'running', 'completed');--> statement-breakpoint
CREATE TYPE "public"."experiment_type" AS ENUM('trigger', 'position', 'template');--> statement-breakpoint
CREATE TABLE "experiment_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"variant_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "experiment_type" NOT NULL,
	"variants" jsonb NOT NULL,
	"traffic_split" jsonb NOT NULL,
	"status" "experiment_status" DEFAULT 'draft' NOT NULL,
	"winner_variant_index" integer,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonial_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"testimonial_id" uuid NOT NULL,
	"language" text NOT NULL,
	"quote" text,
	"transcript" jsonb,
	"provider" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial_translations" ADD CONSTRAINT "testimonial_translations_testimonial_id_testimonials_id_fk" FOREIGN KEY ("testimonial_id") REFERENCES "public"."testimonials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiment_assignments_exp_session_idx" ON "experiment_assignments" USING btree ("experiment_id","session_id");--> statement-breakpoint
CREATE INDEX "experiments_space_status_idx" ON "experiments" USING btree ("space_id","status");--> statement-breakpoint
CREATE INDEX "testimonial_translations_testimonial_lang_idx" ON "testimonial_translations" USING btree ("testimonial_id","language");