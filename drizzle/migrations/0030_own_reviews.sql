ALTER TYPE "public"."review_provider" ADD VALUE 'own';--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "link_url" text;