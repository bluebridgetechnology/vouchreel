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
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const platformEnum = pgEnum("platform", [
  "youtube",
  "vimeo",
  "mp4",
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

// ─── BetterAuth Tables ──────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role").default("owner"),
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
  videoUrl: text("video_url").notNull(),
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
});

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

// ─── Relations ──────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  spaces: many(spaces),
  subscriptions: many(subscriptions),
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
}));

export const testimonialsRelations = relations(testimonials, ({ one }) => ({
  space: one(spaces, {
    fields: [testimonials.spaceId],
    references: [spaces.id],
  }),
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
