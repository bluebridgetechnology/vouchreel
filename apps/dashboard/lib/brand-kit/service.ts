import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brandKits, widgetConfigs } from "@/lib/db/schema";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/validations/widget-config";
import type { BrandKitInput } from "@/lib/validations/brand-kit";
import type { BrandKitValues } from "./theme";

export type BrandKitRow = typeof brandKits.$inferSelect;

export { applyBrandKitToTheme, type BrandKitValues } from "./theme";

export async function getBrandKit(spaceId: string): Promise<BrandKitRow | null> {
  const [kit] = await db.select().from(brandKits).where(eq(brandKits.spaceId, spaceId));
  return kit ?? null;
}

/**
 * What the Brand page shows before anything is saved: the values the widget uses today, so saving
 * the page does not silently change how the widget looks. New kits default to the host site's font.
 */
export async function suggestedBrandValues(spaceId: string): Promise<BrandKitValues> {
  const [config] = await db.select({ theme: widgetConfigs.theme }).from(widgetConfigs).where(eq(widgetConfigs.spaceId, spaceId));
  const theme = { ...DEFAULT_WIDGET_CONFIG.theme, ...((config?.theme as Record<string, unknown> | null) ?? {}) } as Record<string, unknown>;
  return {
    primaryColor: typeof theme.primaryColor === "string" ? theme.primaryColor : DEFAULT_BRAND_HEX,
    accentColor: typeof theme.accentColor === "string" ? theme.accentColor : null,
    borderRadius: typeof theme.borderRadius === "number" ? theme.borderRadius : null,
    fontMode: "inherit",
    fontFamily: null,
    inheritTextColor: false,
    videoStyle: null,
    videoSecondaryColor: null,
  };
}

export function toValues(kit: BrandKitRow): BrandKitValues {
  return {
    primaryColor: kit.primaryColor,
    accentColor: kit.accentColor,
    borderRadius: kit.borderRadius,
    fontMode: kit.fontMode,
    fontFamily: kit.fontFamily,
    inheritTextColor: kit.inheritTextColor,
    videoStyle: kit.videoStyle,
    videoSecondaryColor: kit.videoSecondaryColor,
  };
}

/** Values to store, with a stale font name dropped when the mode does not use one. */
export function valuesToStore(input: BrandKitInput): BrandKitValues {
  return {
    primaryColor: input.primaryColor,
    accentColor: input.accentColor ?? null,
    borderRadius: input.borderRadius ?? null,
    fontMode: input.fontMode,
    fontFamily: input.fontMode === "custom" ? (input.fontFamily ?? null) : null,
    inheritTextColor: input.inheritTextColor,
    videoStyle: input.videoStyle ?? null,
    // A second colour only applies to the colour styles; light and dark ignore it, so do not keep a stale one
    videoSecondaryColor: input.videoStyle === "light" || input.videoStyle === "dark" ? null : (input.videoSecondaryColor ?? null),
  };
}

export async function saveBrandKit(spaceId: string, input: BrandKitInput): Promise<BrandKitRow> {
  const values = valuesToStore(input);
  const [row] = await db
    .insert(brandKits)
    .values({ spaceId, ...values })
    .onConflictDoUpdate({ target: brandKits.spaceId, set: { ...values, updatedAt: new Date() } })
    .returning();
  return row;
}
