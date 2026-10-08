ALTER TABLE "reviews" ADD COLUMN "text_fetched_at" timestamp with time zone;
--> statement-breakpoint
-- Existing third-party reviews: count their text as fetched when the row was created, so the first purge treats them like any other old text
UPDATE "reviews" SET "text_fetched_at" = "created_at" WHERE "provider" <> 'own' AND "text" IS NOT NULL;
