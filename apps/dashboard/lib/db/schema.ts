import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
  isActive: boolean("is_active").default(true).notNull(),
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
  rating: integer("rating").notNull(),
  text: text("text"),
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
