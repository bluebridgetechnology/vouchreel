CREATE TYPE "public"."team_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_owner_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "team_role" DEFAULT 'editor' NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_owner_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "team_role" DEFAULT 'editor' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "white_label_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"logo_url" text,
	"custom_domain" text,
	"cname_verified" boolean DEFAULT false NOT NULL,
	"remove_branding" boolean DEFAULT false NOT NULL,
	"custom_email_sender" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "white_label_settings_space_id_unique" UNIQUE("space_id")
);
--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_owner_id_user_id_fk" FOREIGN KEY ("team_owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_owner_id_user_id_fk" FOREIGN KEY ("team_owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "white_label_settings" ADD CONSTRAINT "white_label_settings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_invites_owner_email_idx" ON "team_invites" USING btree ("team_owner_id","email");--> statement-breakpoint
CREATE INDEX "team_invites_token_idx" ON "team_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_owner_user_idx" ON "team_members" USING btree ("team_owner_id","user_id");--> statement-breakpoint
CREATE INDEX "team_members_owner_idx" ON "team_members" USING btree ("team_owner_id");--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "white_label_settings_space_idx" ON "white_label_settings" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "white_label_settings_custom_domain_idx" ON "white_label_settings" USING btree ("custom_domain");