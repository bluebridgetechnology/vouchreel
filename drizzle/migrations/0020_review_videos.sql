CREATE TABLE "review_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"created_by" text,
	"template" text NOT NULL,
	"aspect" text DEFAULT '9:16' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"props" jsonb NOT NULL,
	"review_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rights_confirmed_at" timestamp with time zone NOT NULL,
	"credits_used" integer DEFAULT 1 NOT NULL,
	"job_id" uuid,
	"output_url" text,
	"duration_seconds" integer,
	"render_ms" integer,
	"error" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "review_sources" ADD COLUMN "rating_average" real;--> statement-breakpoint
ALTER TABLE "review_sources" ADD COLUMN "rating_total" integer;--> statement-breakpoint
ALTER TABLE "review_videos" ADD CONSTRAINT "review_videos_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_videos" ADD CONSTRAINT "review_videos_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_videos" ADD CONSTRAINT "review_videos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_videos_space_created_idx" ON "review_videos" USING btree ("space_id","created_at");