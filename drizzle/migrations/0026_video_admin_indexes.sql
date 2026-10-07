CREATE INDEX "generated_videos_trim_approved_idx" ON "generated_videos" USING btree ("trim_approved_at");--> statement-breakpoint
CREATE INDEX "generated_videos_created_idx" ON "generated_videos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "review_videos_created_idx" ON "review_videos" USING btree ("created_at");