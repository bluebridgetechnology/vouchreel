CREATE TABLE "widget_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"widget_id" uuid NOT NULL,
	"config" jsonb NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "widget_versions" ADD CONSTRAINT "widget_versions_widget_id_widget_configs_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widget_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "widget_versions_widget_idx" ON "widget_versions" USING btree ("widget_id","created_at");