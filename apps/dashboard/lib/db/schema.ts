import { relations } from "drizzle-orm";
import type { VideoFontId } from "@vouchreel/video";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

// ─── Enums ──────────────────────────────────────────────────────────────────

export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "editor",
  "viewer",
]);

export const platformEnum = pgEnum("platform", [
  "youtube",
  "vimeo",
  "mp4",
  "text",
]);

export const reviewProviderEnum = pgEnum("review_provider", [
  "google",
  "trustpilot",
  // Typed in by the space owner: no provider, no rating
  "own",
]);

export const widgetTemplateEnum = pgEnum("widget_template", [
  "wall-of-love",
  "carousel",
  "story-strip",
  "floating-card",
  "masonry",
]);

export const widgetPositionEnum = pgEnum("widget_position", [
  "bottom-right",
  "bottom-left",
  "bottom-bar",
  "story-strip",
]);

export const triggerTypeEnum = pgEnum("trigger_type", [
  "delay",
  "exit-intent",
  "scroll-depth",
  "pageview-count",
  "returning-visitor",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "impression",
  "play",
  "click",
  "convert",
]);

export const goalTypeEnum = pgEnum("goal_type", [
  "url-match",
  "pixel",
]);

export const experimentTypeEnum = pgEnum("experiment_type", [
  "trigger",
  "position",
  "template",
]);

export const experimentStatusEnum = pgEnum("experiment_status", [
  "draft",
  "running",
  "completed",
]);

export const clipStatusEnum = pgEnum("clip_status", [
  "none",
  "pending",
  "processing",
  "done",
  "failed",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
  "incomplete",
  "paused",
]);

export const planIntervalEnum = pgEnum("plan_interval", [
  "month",
  "year",
]);

export const incentiveTypeEnum = pgEnum("incentive_type", [
  "none",
  "discount",
  "custom",
]);

export const submissionTypeEnum = pgEnum("submission_type", [
  "video",
  "text",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
]);

export const processingStatusEnum = pgEnum("processing_status", [
  "none",
  "pending",
  "processing",
  "done",
  "failed",
]);

export const webhookEventEnum = pgEnum("webhook_event", [
  "testimonial.created",
  "testimonial.updated",
  "testimonial.deleted",
  "submission.received",
  "submission.approved",
  "conversion.tracked",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "success",
  "failed",
  "retrying",
]);

export const socialExportFormatEnum = pgEnum("social_export_format", [
  "tiktok",
  "reels",
  "shorts",
]);

export const socialExportStatusEnum = pgEnum("social_export_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const watermarkPositionEnum = pgEnum("watermark_position", [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
]);

export const exportFramingEnum = pgEnum("export_framing", [
  "blur",
  "letterbox",
]);

export interface CollectionFormBranding {
  accentColor?: string;
  logoUrl?: string;
}

// ─── BetterAuth Tables ──────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  /** Legacy, unused for authorization. Platform access is `isPlatformAdmin`. */
  role: text("role").default("owner"),
  isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
  /** Sign-in asks for a code from an authenticator app (Better Auth two-factor plugin). */
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  /** A platform admin suspended this account: it cannot sign in, and open sessions stop working. */
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  /** Shown to the person on a refused sign-in. */
  suspendedReason: text("suspended_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Better Auth two-factor plugin: one row per account that has set up an authenticator app. */
export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
}, (table) => [index("two_factor_user_idx").on(table.userId)]);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── App Tables ─────────────────────────────────────────────────────────────

/**
 * Spaces — a container for testimonials. Each space has a unique embed key
 * used by the widget script to fetch its config and testimonials.
 */
export const spaces = pgTable("spaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  embedKey: text("embed_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Testimonials — individual video testimonials linked to a space.
 * Includes Phase 2 placeholder fields for AI auto-clipping.
 */
export const testimonials = pgTable("testimonials", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  videoUrl: text("video_url"),
  platform: platformEnum("platform").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  title: text("title"),
  durationSeconds: integer("duration_seconds"),
  quote: text("quote"),
  customerName: text("customer_name"),
  customerCompany: text("customer_company"),
  tags: text("tags").array().default([]),
  matchRules: jsonb("match_rules").$type<Record<string, unknown>>(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Phase 2 placeholder fields for AI auto-clipping
  clipStatus: clipStatusEnum("clip_status").default("none").notNull(),
  clipUrl: text("clip_url"),
  transcriptUrl: text("transcript_url"),
});

/**
 * Widget configuration — one config per space, controls how the
 * embed widget looks and behaves on the customer's site.
 */
export const widgetConfigs = pgTable("widget_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .unique()
    .references(() => spaces.id, { onDelete: "cascade" }),
  template: widgetTemplateEnum("template").default("floating-card").notNull(),
  position: widgetPositionEnum("position").default("bottom-right").notNull(),
  theme: jsonb("theme").$type<Record<string, unknown>>().default({}),
  triggerType: triggerTypeEnum("trigger_type").default("delay").notNull(),
  triggerValue: jsonb("trigger_value").$type<Record<string, unknown>>().default({ seconds: 3 }),
  pagesIncluded: text("pages_included").array().default([]),
  pagesExcluded: text("pages_excluded").array().default([]),
  autoplayPreview: boolean("autoplay_preview").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Analytics events — captures widget interactions for the analytics dashboard.
 */
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  testimonialId: uuid("testimonial_id").references(() => testimonials.id, {
    onDelete: "set null",
  }),
  sessionId: text("session_id"),
  eventType: eventTypeEnum("event_type").notNull(),
  pageUrl: text("page_url"),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .defaultNow()
    .notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
}, (table) => [
  index("events_space_type_ts_idx").on(table.spaceId, table.eventType, table.timestamp),
  index("events_space_testimonial_type_idx").on(table.spaceId, table.testimonialId, table.eventType),
]);

/**
 * Conversion goals — defines what counts as a conversion for analytics.
 */
export const conversionGoals = pgTable("conversion_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  goalType: goalTypeEnum("goal_type").notNull(),
  goalValue: text("goal_value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Subscription plans — defines available pricing tiers.
 */
export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(), // price in cents
  interval: planIntervalEnum("interval").notNull(),
  features: jsonb("features").$type<string[]>().default([]),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  dodoProductId: text("dodo_product_id"),
  dodoPriceId: text("dodo_price_id"),
  /** Short marketing blurb shown on the pricing card. */
  description: text("description"),
  /** Ribbon text, e.g. "Most popular". */
  badge: text("badge"),
  /** Entitlements for this plan. -1 means unlimited. Null falls back to name-based presets. */
  limits: jsonb("limits").$type<Record<string, number | boolean | string>>(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isCustom: boolean("is_custom").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Platform-admin audit trail (plan edits, role grants...). Append-only.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    changes: jsonb("changes").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("admin_audit_log_created_idx").on(table.createdAt)]
);

/**
 * User subscriptions — tracks which plan each user is on.
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  provider: text("provider"),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  /** Time of the newest provider event applied to this row, so a late older event cannot undo a newer one. */
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Payment webhook events already handled, so a provider re-sending an event (they retry) is applied once.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("webhook_events_provider_event_idx").on(table.provider, table.eventId), index("webhook_events_received_idx").on(table.receivedAt)]
);

/**
 * Admin settings — key-value store for global admin configuration
 * (e.g., which payment provider is active).
 */
export const adminSettings = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
});

/**
 * Collection forms — owners share a link (/collect/{slug}) so their
 * customers can submit testimonials directly (video recording, upload, text).
 */
export const collectionForms = pgTable("collection_forms", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  promptText: text("prompt_text").notNull(),
  incentiveType: incentiveTypeEnum("incentive_type").default("none").notNull(),
  incentiveValue: text("incentive_value"),
  branding: jsonb("branding")
    .$type<CollectionFormBranding>()
    .default({})
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  /** Which submission types the public form offers (lib/collect/modes.ts). */
  collectModes: text("collect_modes").$type<"both" | "video" | "text">().default("both").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("collection_forms_space_idx").on(table.spaceId),
]);

/**
 * Submissions — customer testimonial submissions awaiting owner review.
 * Video submissions are transcoded asynchronously (see lib/transcode.ts).
 */
export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  formId: uuid("form_id")
    .notNull()
    .references(() => collectionForms.id, { onDelete: "cascade" }),
  type: submissionTypeEnum("type").notNull(),
  videoUrl: text("video_url"),
  text: text("text"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  status: submissionStatusEnum("status").default("pending").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  processingStatus: processingStatusEnum("processing_status")
    .default("none")
    .notNull(),
  /** User-safe reason when processing_status is "failed". */
  processingError: text("processing_error"),
  /** When the customer ticked the "may be turned into an AI-narrated video" box; null = no consent. */
  aiVideoConsentAt: timestamp("ai_video_consent_at", { withTimezone: true }),
  /** Version of the consent wording shown (lib/ai-video/consent.ts). */
  aiVideoConsentVersion: text("ai_video_consent_version"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("submissions_form_status_idx").on(table.formId, table.status),
]);

/**
 * Review Sources — accounts/businesses connected to import external reviews
 * (e.g. Google Places, Trustpilot Business).
 */
export const reviewSources = pgTable("review_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  provider: reviewProviderEnum("provider").notNull(),
  providerBusinessId: text("provider_business_id").notNull(),
  credentials: jsonb("credentials")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  /** Overall rating and review count as reported by the provider (not computed from our copy). */
  ratingAverage: real("rating_average"),
  ratingTotal: integer("rating_total"),
  isActive: boolean("is_active").default(true).notNull(),
  /** How the owner authorised access: their own API key, or signing in with the provider (OAuth). */
  authKind: text("auth_kind").$type<"api_key" | "oauth">().default("api_key").notNull(),
  /** Shown to the owner: the business or location name when the provider gave one. */
  displayName: text("display_name"),
  /** Why the last sync failed, when it did (for example Google access was withdrawn); cleared by a good sync. */
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("review_sources_space_provider_idx").on(table.spaceId, table.provider),
]);

/**
 * Reviews — imported text reviews from external sources (Google, Trustpilot).
 */
export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id")
    .references(() => reviewSources.id, { onDelete: "cascade" }),
  provider: reviewProviderEnum("provider").notNull(),
  authorName: text("author_name").notNull(),
  authorPhotoUrl: text("author_photo_url"),
  // Null only for owner-supplied reviews (provider "own")
  rating: integer("rating"),
  text: text("text"),
  /**
   * When `text` was last fetched from the provider. Third-party review text is only kept for a limited time
   * (REVIEW_TEXT_RETENTION_DAYS): the hourly sync refreshes it for reviews the provider still returns, and the
   * purge in lib/reviews/retention.ts removes it once it is older. Null for owner-supplied reviews (their own text).
   */
  textFetchedAt: timestamp("text_fetched_at", { withTimezone: true }),
  /** Owner-supplied reviews: the page the review came from (https), shown as its domain */
  linkUrl: text("link_url"),
  reviewDate: timestamp("review_date", { withTimezone: true }),
  providerReviewId: text("provider_review_id").notNull().unique(),
  isApproved: boolean("is_approved").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("reviews_space_approved_idx").on(table.spaceId, table.isApproved),
  index("reviews_source_idx").on(table.sourceId),
]);

/**
 * API keys — enables programmatic access to the public v1 API.
 * Scoped per space. Stores a SHA-256 hash of the key; the raw key is never stored.
 */
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("api_keys_space_idx").on(table.spaceId),
]);

/**
 * Webhook endpoints — configured destination URLs for outbound event notifications.
 */
export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").array().notNull(),
  /** "json" posts the event with a signature; "slack" posts {"text": "..."} for a Slack incoming webhook. */
  format: text("format").$type<"json" | "slack">().default("json").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("webhook_endpoints_space_idx").on(table.spaceId),
]);

/**
 * Webhook deliveries — log of dispatched webhook attempts and retry scheduling.
 */
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  endpointId: uuid("endpoint_id")
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: deliveryStatusEnum("status").default("pending").notNull(),
  httpStatus: integer("http_status"),
  responseBody: text("response_body"),
  attemptCount: integer("attempt_count").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(4).notNull(),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("webhook_deliveries_endpoint_idx").on(table.endpointId),
  index("webhook_deliveries_status_retry_idx").on(table.status, table.nextRetryAt),
]);

/**
 * Social export settings — per-space branding and default layout settings
 * for social media video exports (TikTok, Reels, Shorts).
 */
export const socialExportSettings = pgTable("social_export_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .unique()
    .references(() => spaces.id, { onDelete: "cascade" }),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").default("#cf3d0b").notNull(),
  watermarkPosition: watermarkPositionEnum("watermark_position")
    .default("bottom-right")
    .notNull(),
  showWatermark: boolean("show_watermark").default(true).notNull(),
  defaultFraming: exportFramingEnum("default_framing").default("blur").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Social exports — tracked video exports formatted for TikTok, Reels, or Shorts.
 */
export const socialExports = pgTable("social_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  testimonialId: uuid("testimonial_id")
    .notNull()
    .references(() => testimonials.id, { onDelete: "cascade" }),
  format: socialExportFormatEnum("format").notNull(),
  outputUrl: text("output_url"),
  status: socialExportStatusEnum("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("social_exports_space_idx").on(table.spaceId, table.createdAt),
  index("social_exports_testimonial_idx").on(table.testimonialId, table.createdAt),
]);

/**
 * Experiments — A/B testing configurations for widget variations.
 */
export const experiments = pgTable("experiments", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: experimentTypeEnum("type").notNull(),
  variants: jsonb("variants")
    .$type<Array<{ id: string; name: string; config: Record<string, unknown> }>>()
    .notNull(),
  trafficSplit: jsonb("traffic_split").$type<number[]>().notNull(),
  status: experimentStatusEnum("status").default("draft").notNull(),
  winnerVariantIndex: integer("winner_variant_index"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("experiments_space_status_idx").on(table.spaceId, table.status),
]);

/**
 * Experiment assignments — tracks session variant assignments for deterministic A/B testing.
 */
export const experimentAssignments = pgTable("experiment_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentId: uuid("experiment_id")
    .notNull()
    .references(() => experiments.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  variantIndex: integer("variant_index").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("experiment_assignments_exp_session_idx").on(table.experimentId, table.sessionId),
]);

/**
 * Testimonial translations — cached translated transcripts and quotes for multi-language captions.
 */
export const testimonialTranslations = pgTable("testimonial_translations", {
  id: uuid("id").defaultRandom().primaryKey(),
  testimonialId: uuid("testimonial_id")
    .notNull()
    .references(() => testimonials.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  quote: text("quote"),
  transcript: jsonb("transcript").$type<unknown>(),
  provider: text("provider").default("auto").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("testimonial_translations_testimonial_lang_idx").on(table.testimonialId, table.language),
]);

/**
 * Team members — multi-seat accounts linking invited users to account owners with roles.
 */
export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamOwnerId: text("team_owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: teamRoleEnum("role").default("editor").notNull(),
  invitedAt: timestamp("invited_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("team_members_owner_user_idx").on(table.teamOwnerId, table.userId),
  index("team_members_owner_idx").on(table.teamOwnerId),
  index("team_members_user_idx").on(table.userId),
]);

/**
 * Team invites — pending invitations with secure tokens.
 */
export const teamInvites = pgTable("team_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamOwnerId: text("team_owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: teamRoleEnum("role").default("editor").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("team_invites_owner_email_idx").on(table.teamOwnerId, table.email),
  index("team_invites_token_idx").on(table.token),
]);

/**
 * White-label settings — space-level branding customizations for Agency/Pro tiers.
 */
export const whiteLabelSettings = pgTable("white_label_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .unique()
    .references(() => spaces.id, { onDelete: "cascade" }),
  logoUrl: text("logo_url"),
  customDomain: text("custom_domain"),
  cnameVerified: boolean("cname_verified").default(false).notNull(),
  removeBranding: boolean("remove_branding").default(false).notNull(),
  customEmailSender: text("custom_email_sender"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("white_label_settings_space_idx").on(table.spaceId),
  index("white_label_settings_custom_domain_idx").on(table.customDomain),
]);

// ─── Relations ──────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  spaces: many(spaces),
  subscriptions: many(subscriptions),
  ownedTeams: many(teamMembers, { relationName: "teamOwner" }),
  teamMemberships: many(teamMembers, { relationName: "teamMember" }),
  sentInvites: many(teamInvites),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const spacesRelations = relations(spaces, ({ many, one }) => ({
  owner: one(user, {
    fields: [spaces.ownerId],
    references: [user.id],
  }),
  testimonials: many(testimonials),
  widgetConfig: one(widgetConfigs),
  events: many(events),
  conversionGoals: many(conversionGoals),
  collectionForms: many(collectionForms),
  reviewSources: many(reviewSources),
  reviews: many(reviews),
  apiKeys: many(apiKeys),
  webhookEndpoints: many(webhookEndpoints),
  socialExportSettings: one(socialExportSettings),
  socialExports: many(socialExports),
  experiments: many(experiments),
  whiteLabelSettings: one(whiteLabelSettings),
}));

export const collectionFormsRelations = relations(
  collectionForms,
  ({ one, many }) => ({
    space: one(spaces, {
      fields: [collectionForms.spaceId],
      references: [spaces.id],
    }),
    submissions: many(submissions),
  })
);

export const submissionsRelations = relations(submissions, ({ one }) => ({
  form: one(collectionForms, {
    fields: [submissions.formId],
    references: [collectionForms.id],
  }),
}));

export const testimonialsRelations = relations(testimonials, ({ one, many }) => ({
  space: one(spaces, {
    fields: [testimonials.spaceId],
    references: [spaces.id],
  }),
  socialExports: many(socialExports),
  translations: many(testimonialTranslations),
}));

export const widgetConfigsRelations = relations(widgetConfigs, ({ one }) => ({
  space: one(spaces, {
    fields: [widgetConfigs.spaceId],
    references: [spaces.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  space: one(spaces, {
    fields: [events.spaceId],
    references: [spaces.id],
  }),
  testimonial: one(testimonials, {
    fields: [events.testimonialId],
    references: [testimonials.id],
  }),
}));

export const conversionGoalsRelations = relations(
  conversionGoals,
  ({ one }) => ({
    space: one(spaces, {
      fields: [conversionGoals.spaceId],
      references: [spaces.id],
    }),
  })
);

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));

export const reviewSourcesRelations = relations(
  reviewSources,
  ({ one, many }) => ({
    space: one(spaces, {
      fields: [reviewSources.spaceId],
      references: [spaces.id],
    }),
    reviews: many(reviews),
  })
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  space: one(spaces, {
    fields: [reviews.spaceId],
    references: [spaces.id],
  }),
  source: one(reviewSources, {
    fields: [reviews.sourceId],
    references: [reviewSources.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  space: one(spaces, {
    fields: [apiKeys.spaceId],
    references: [spaces.id],
  }),
}));

export const webhookEndpointsRelations = relations(
  webhookEndpoints,
  ({ one, many }) => ({
    space: one(spaces, {
      fields: [webhookEndpoints.spaceId],
      references: [spaces.id],
    }),
    deliveries: many(webhookDeliveries),
  })
);

export const webhookDeliveriesRelations = relations(
  webhookDeliveries,
  ({ one }) => ({
    endpoint: one(webhookEndpoints, {
      fields: [webhookDeliveries.endpointId],
      references: [webhookEndpoints.id],
    }),
  })
);

export const socialExportSettingsRelations = relations(
  socialExportSettings,
  ({ one }) => ({
    space: one(spaces, {
      fields: [socialExportSettings.spaceId],
      references: [spaces.id],
    }),
  })
);

export const socialExportsRelations = relations(
  socialExports,
  ({ one }) => ({
    space: one(spaces, {
      fields: [socialExports.spaceId],
      references: [spaces.id],
    }),
    testimonial: one(testimonials, {
      fields: [socialExports.testimonialId],
      references: [testimonials.id],
    }),
  })
);

export const experimentsRelations = relations(experiments, ({ one, many }) => ({
  space: one(spaces, {
    fields: [experiments.spaceId],
    references: [spaces.id],
  }),
  assignments: many(experimentAssignments),
}));

export const experimentAssignmentsRelations = relations(
  experimentAssignments,
  ({ one }) => ({
    experiment: one(experiments, {
      fields: [experimentAssignments.experimentId],
      references: [experiments.id],
    }),
  })
);

export const testimonialTranslationsRelations = relations(
  testimonialTranslations,
  ({ one }) => ({
    testimonial: one(testimonials, {
      fields: [testimonialTranslations.testimonialId],
      references: [testimonials.id],
    }),
  })
);

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  teamOwner: one(user, {
    fields: [teamMembers.teamOwnerId],
    references: [user.id],
    relationName: "teamOwner",
  }),
  user: one(user, {
    fields: [teamMembers.userId],
    references: [user.id],
    relationName: "teamMember",
  }),
}));

export const teamInvitesRelations = relations(teamInvites, ({ one }) => ({
  teamOwner: one(user, {
    fields: [teamInvites.teamOwnerId],
    references: [user.id],
  }),
}));

export const whiteLabelSettingsRelations = relations(whiteLabelSettings, ({ one }) => ({
  space: one(spaces, {
    fields: [whiteLabelSettings.spaceId],
    references: [spaces.id],
  }),
}));




// ─── Notifications ──────────────────────────────────────────────────────────

/**
 * In-app notification inbox. One row per user per event. `dedupeKey` lets noisy
 * events (plan limit, failing webhooks) collapse into a single unread entry.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    dedupeKey: text("dedupe_key"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    index("notifications_user_unread_idx").on(table.userId, table.readAt),
    index("notifications_dedupe_idx").on(table.userId, table.dedupeKey),
  ]
);

/** Per-user channel overrides. Missing rows fall back to the catalog defaults. */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    inApp: boolean("in_app").default(true).notNull(),
    email: boolean("email").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("notification_preferences_user_type_idx").on(table.userId, table.type)]
);

/**
 * Durable background jobs. A worker claims rows with FOR UPDATE SKIP LOCKED, so jobs survive
 * restarts and run one at a time; stale locks are reclaimed (see lib/jobs/queue.ts).
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    status: text("status").$type<"queued" | "running" | "done" | "failed">().default("queued").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("jobs_status_run_at_idx").on(table.status, table.runAt)]
);

/**
 * Proof that the person who wrote a testimonial agreed to AI-narrated video being made from it.
 * Required before any generated_videos row can exist (FTC rule on AI-generated reviews).
 */
export const testimonialConsents = pgTable(
  "testimonial_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    testimonialId: uuid("testimonial_id")
      .notNull()
      .references(() => testimonials.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"ai_video">().default("ai_video").notNull(),
    /** collect_form = ticked by the customer; email_reconsent = confirmed via emailed link. */
    source: text("source").$type<"collect_form" | "email_reconsent">().notNull(),
    /** Version of the consent wording shown, so the exact text can be reconstructed later. */
    textVersion: text("text_version").notNull(),
    submissionId: uuid("submission_id").references(() => submissions.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("testimonial_consents_testimonial_idx").on(table.testimonialId, table.kind)]
);

/**
 * AI-narrated motion-graphic videos made from a written testimonial. No synthetic likeness or
 * cloned voice of the customer; the widget labels these as AI-generated.
 */
export const generatedVideos = pgTable(
  "generated_videos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    testimonialId: uuid("testimonial_id")
      .notNull()
      .references(() => testimonials.id, { onDelete: "cascade" }),
    /** Restrict: consent evidence must outlive any video made under it. */
    consentId: uuid("consent_id")
      .notNull()
      .references(() => testimonialConsents.id, { onDelete: "restrict" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    /** draft = awaiting trim approval; queued/rendering = job in flight. */
    status: text("status")
      .$type<"draft" | "queued" | "rendering" | "done" | "failed">()
      .default("draft")
      .notNull(),
    template: text("template").notNull(),
    voice: text("voice").notNull(),
    aspect: text("aspect").$type<"9:16" | "16:9">().default("9:16").notNull(),
    /** Language of the narration; non-original languages use testimonial_translations. */
    language: text("language").default("en").notNull(),
    scriptOriginal: text("script_original").notNull(),
    /** Length-trimmed version shown to the owner as a diff; null until proposed. */
    scriptTrimmed: text("script_trimmed"),
    trimApprovedAt: timestamp("trim_approved_at", { withTimezone: true }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    creditsUsed: integer("credits_used").default(1).notNull(),
    /** Provider cost in cents, for margin tracking. */
    costCents: integer("cost_cents"),
    outputUrl: text("output_url"),
    durationSeconds: integer("duration_seconds"),
    error: text("error"),
    /** The owner chose to show this video in their embedded widget. Off until they do. */
    showInWidget: boolean("show_in_widget").default(false).notNull(),
    /** Owner deleted a finished video. The row stays so the credit it used is still counted. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** A platform admin took this video down: its file is deleted and its URL cleared. Irreversible. */
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderatedBy: text("moderated_by").references(() => user.id, { onDelete: "set null" }),
    /** Shown to the owner. */
    moderationReason: text("moderation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("generated_videos_testimonial_idx").on(table.testimonialId, table.createdAt),
    index("generated_videos_space_created_idx").on(table.spaceId, table.createdAt),
    // Admin Usage (by month) and Moderation (newest first) read across all spaces
    index("generated_videos_trim_approved_idx").on(table.trimApprovedAt),
    index("generated_videos_created_idx").on(table.createdAt),
  ]
);

/**
 * Styled videos made from imported reviews (Remotion templates). `props` is the exact, verbatim
 * snapshot that was rendered, so a video can always be traced to the reviews it shows.
 */
export const reviewVideos = pgTable(
  "review_videos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    template: text("template").notNull(),
    aspect: text("aspect").$type<"9:16" | "16:9">().default("9:16").notNull(),
    status: text("status").$type<"queued" | "rendering" | "done" | "failed">().default("queued").notNull(),
    /** ReviewVideoProps as rendered: verbatim review text, authors, ratings, brand colour, aggregate. */
    props: jsonb("props").$type<Record<string, unknown>>().notNull(),
    reviewIds: jsonb("review_ids").$type<string[]>().default([]).notNull(),
    /** The owner chose to show this video in their embedded widget. Off until they do. */
    showInWidget: boolean("show_in_widget").default(false).notNull(),
    /** The owner confirmed they may use these reviews in marketing. Required to create a video. */
    rightsConfirmedAt: timestamp("rights_confirmed_at", { withTimezone: true }).notNull(),
    /** Which wording of the rights statement the owner saw (lib/review-video/rights.ts). Null on videos made before it was recorded. */
    rightsWordingVersion: text("rights_wording_version"),
    creditsUsed: integer("credits_used").default(1).notNull(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    outputUrl: text("output_url"),
    durationSeconds: integer("duration_seconds"),
    renderMs: integer("render_ms"),
    error: text("error"),
    /** Owner deleted a finished video; the row stays so its credit is still counted. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** A platform admin took this video down: its file is deleted and its URL cleared. Irreversible. */
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderatedBy: text("moderated_by").references(() => user.id, { onDelete: "set null" }),
    /** Shown to the owner. */
    moderationReason: text("moderation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("review_videos_space_created_idx").on(table.spaceId, table.createdAt),
    index("review_videos_created_idx").on(table.createdAt),
  ]
);

/**
 * Brand kit: one per space. When it exists it is the source for the widget's colours, radius and
 * typography (and the default colour of review videos), so they are set in one place.
 */
export const brandKits = pgTable("brand_kits", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .unique()
    .references(() => spaces.id, { onDelete: "cascade" }),
  primaryColor: text("primary_color").default("#cf3d0b").notNull(),
  /** Text/icon colour on top of the primary colour. Null = the widget's default. */
  accentColor: text("accent_color"),
  borderRadius: integer("border_radius"),
  /** default = the widget's own font; inherit = the host site's font; custom = a named font the site loads. */
  fontMode: text("font_mode").$type<"default" | "inherit" | "custom">().default("inherit").notNull(),
  fontFamily: text("font_family"),
  /** Use the host site's text colour when it stays readable on the widget background. */
  inheritTextColor: boolean("inherit_text_color").default(false).notNull(),
  /** Default background style for review videos. Null = each template's own default. */
  videoStyle: text("video_style").$type<"gradient" | "solid" | "aurora" | "dots" | "light" | "dark">(),
  /** Optional second colour for review video backgrounds. */
  videoSecondaryColor: text("video_secondary_color"),
  /** Font for review video text (an id from the font catalogue in @vouchreel/video). Null = each template's own typography. */
  videoFont: text("video_font").$type<VideoFontId>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * One row per job-worker process, refreshed every few seconds while it runs. The admin System
 * tab reads it to show whether workers are alive. Rows are best-effort telemetry: a missing row
 * means "never seen", not "not running".
 */
export const workerHeartbeats = pgTable(
  "worker_heartbeats",
  {
    workerId: text("worker_id").primaryKey(),
    /** worker = social exports and AI video; video-worker = review videos (needs Chromium). */
    kind: text("kind").$type<"worker" | "video-worker">().notNull(),
    hostname: text("hostname"),
    pid: integer("pid"),
    concurrency: integer("concurrency").default(1).notNull(),
    /** Jobs this process has claimed since it started. */
    jobsProcessed: integer("jobs_processed").default(0).notNull(),
    /** What the process found on start-up, e.g. { ffmpeg: "7.1", chromium: "ok" }. */
    capabilities: jsonb("capabilities").$type<Record<string, string>>().default({}).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    /** Set on a clean shutdown. */
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    /** A platform admin asked this process to finish its jobs and exit; its supervisor restarts it. Ignored if older than this process's start. */
    restartRequestedAt: timestamp("restart_requested_at", { withTimezone: true }),
  },
  (table) => [index("worker_heartbeats_last_seen_idx").on(table.lastSeenAt)]
);

/**
 * Last known state of each thing the platform alerts admins about (for example "worker:video-worker"),
 * so one outage sends one email, not one every few minutes.
 */
export const adminAlertState = pgTable("admin_alert_state", {
  key: text("key").primaryKey(),
  /** "ok", "warning" or "critical" as of the last check. */
  severity: text("severity").notNull(),
  /** When it entered this severity. */
  since: timestamp("since", { withTimezone: true }).notNull(),
  /** The last time an email went out for it. */
  lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
  /** Whether that email was about a problem (so a recovery email is owed). */
  problemNotified: boolean("problem_notified").default(false).notNull(),
});


/**
 * Extra (or fewer) video credits a platform admin gave one account for one calendar month, on top
 * of the plan's allowance. Append-only: a correction is another row.
 */
export const creditAdjustments = pgTable(
  "credit_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"review" | "ai">().notNull(),
    /** Positive adds credits, negative removes them. */
    amount: integer("amount").notNull(),
    /** The UTC calendar month it applies to, "YYYY-MM". */
    month: text("month").notNull(),
    reason: text("reason").notNull(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("credit_adjustments_user_month_idx").on(table.userId, table.month)]
);

/**
 * "Download my data" requests. The zip is kept here (not in public file storage) so it is only ever
 * served to its owner by an authenticated route, and is deleted after a week.
 */
export const dataExports = pgTable(
  "data_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").$type<"queued" | "ready" | "failed">().default("queued").notNull(),
    /** The finished zip. Null until ready, and again once expired. */
    zip: bytea("zip"),
    sizeBytes: integer("size_bytes"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [index("data_exports_user_idx").on(table.userId, table.createdAt)]
);
