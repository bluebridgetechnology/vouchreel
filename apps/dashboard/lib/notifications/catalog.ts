/** Every notification the product can send, with its default channels. */
export const NOTIFICATION_CATALOG = {
  "submission.received": {
    label: "New testimonial submitted",
    description: "Someone sent a video or written testimonial through a collection link.",
    defaults: { inApp: true, email: true },
  },
  "video.processing_failed": {
    label: "Video processing failed",
    description: "An uploaded testimonial video could not be transcoded.",
    defaults: { inApp: true, email: true },
  },
  "social_export.completed": {
    label: "Social export ready",
    description: "A vertical video export finished rendering.",
    defaults: { inApp: true, email: false },
  },
  "social_export.failed": {
    label: "Social export failed",
    description: "A social export could not be rendered.",
    defaults: { inApp: true, email: false },
  },
  "webhook.failing": {
    label: "Webhook deliveries failing",
    description: "A webhook endpoint exhausted its retries.",
    defaults: { inApp: true, email: true },
  },
  "plan.limit_reached": {
    label: "Plan limit reached",
    description: "You tried to go past a limit of your current plan.",
    defaults: { inApp: true, email: false },
  },
  "team.invite_accepted": {
    label: "Team invite accepted",
    description: "Someone joined your workspace.",
    defaults: { inApp: true, email: false },
  },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_CATALOG;

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_CATALOG) as NotificationType[];

export function isNotificationType(value: string): value is NotificationType {
  return value in NOTIFICATION_CATALOG;
}

export interface ChannelPrefs {
  inApp: boolean;
  email: boolean;
}

/** Stored overrides win; anything missing falls back to the catalog default. */
export function resolvePrefs(type: NotificationType, override?: Partial<ChannelPrefs> | null): ChannelPrefs {
  return { ...NOTIFICATION_CATALOG[type].defaults, ...(override ?? {}) };
}
