CREATE TABLE "admin_alert_state" (
	"key" text PRIMARY KEY NOT NULL,
	"severity" text NOT NULL,
	"since" timestamp with time zone NOT NULL,
	"last_notified_at" timestamp with time zone,
	"problem_notified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "worker_heartbeats" ADD COLUMN "restart_requested_at" timestamp with time zone;