ALTER TABLE "review_sources" ADD COLUMN "auth_kind" text DEFAULT 'api_key' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_sources" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "review_sources" ADD COLUMN "last_error" text;