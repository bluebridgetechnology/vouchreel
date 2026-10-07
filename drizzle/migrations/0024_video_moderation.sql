ALTER TABLE "generated_videos" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generated_videos" ADD COLUMN "moderated_by" text;--> statement-breakpoint
ALTER TABLE "generated_videos" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "review_videos" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review_videos" ADD COLUMN "moderated_by" text;--> statement-breakpoint
ALTER TABLE "review_videos" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "generated_videos" ADD CONSTRAINT "generated_videos_moderated_by_user_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_videos" ADD CONSTRAINT "review_videos_moderated_by_user_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;