CREATE TYPE "public"."review_provider" AS ENUM('google', 'trustpilot');--> statement-breakpoint
CREATE TYPE "public"."widget_template" AS ENUM('wall-of-love', 'carousel', 'story-strip', 'floating-card', 'masonry');--> statement-breakpoint
CREATE TABLE "review_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"provider" "review_provider" NOT NULL,
	"provider_business_id" text NOT NULL,
	"credentials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"source_id" uuid,
	"provider" "review_provider" NOT NULL,
	"author_name" text NOT NULL,
	"author_photo_url" text,
	"rating" integer NOT NULL,
	"text" text,
	"review_date" timestamp with time zone,
	"provider_review_id" text NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_provider_review_id_unique" UNIQUE("provider_review_id")
);
--> statement-breakpoint
ALTER TABLE "widget_configs" ADD COLUMN "template" "widget_template" DEFAULT 'floating-card' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_sources" ADD CONSTRAINT "review_sources_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_source_id_review_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."review_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_sources_space_provider_idx" ON "review_sources" USING btree ("space_id","provider");--> statement-breakpoint
CREATE INDEX "reviews_space_approved_idx" ON "reviews" USING btree ("space_id","is_approved");--> statement-breakpoint
CREATE INDEX "reviews_source_idx" ON "reviews" USING btree ("source_id");