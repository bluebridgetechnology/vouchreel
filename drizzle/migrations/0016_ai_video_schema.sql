CREATE TABLE "generated_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"testimonial_id" uuid NOT NULL,
	"consent_id" uuid NOT NULL,
	"created_by" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"template" text NOT NULL,
	"voice" text NOT NULL,
	"aspect" text DEFAULT '9:16' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"script_original" text NOT NULL,
	"script_trimmed" text,
	"trim_approved_at" timestamp with time zone,
	"job_id" uuid,
	"credits_used" integer DEFAULT 1 NOT NULL,
	"cost_cents" integer,
	"output_url" text,
	"duration_seconds" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "testimonial_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"testimonial_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"kind" text DEFAULT 'ai_video' NOT NULL,
	"source" text NOT NULL,
	"text_version" text NOT NULL,
	"submission_id" uuid,
	"granted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "ai_video_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generated_videos" ADD CONSTRAINT "generated_videos_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_videos" ADD CONSTRAINT "generated_videos_testimonial_id_testimonials_id_fk" FOREIGN KEY ("testimonial_id") REFERENCES "public"."testimonials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_videos" ADD CONSTRAINT "generated_videos_consent_id_testimonial_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."testimonial_consents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_videos" ADD CONSTRAINT "generated_videos_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_videos" ADD CONSTRAINT "generated_videos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial_consents" ADD CONSTRAINT "testimonial_consents_testimonial_id_testimonials_id_fk" FOREIGN KEY ("testimonial_id") REFERENCES "public"."testimonials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial_consents" ADD CONSTRAINT "testimonial_consents_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial_consents" ADD CONSTRAINT "testimonial_consents_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_videos_testimonial_idx" ON "generated_videos" USING btree ("testimonial_id","created_at");--> statement-breakpoint
CREATE INDEX "generated_videos_space_created_idx" ON "generated_videos" USING btree ("space_id","created_at");--> statement-breakpoint
CREATE INDEX "testimonial_consents_testimonial_idx" ON "testimonial_consents" USING btree ("testimonial_id","kind");