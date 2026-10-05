import { z } from "zod";
import { BACKGROUND_STYLES } from "@vouchreel/video";

export const FONT_MODES = ["default", "inherit", "custom"] as const;
export type FontModeValue = (typeof FONT_MODES)[number];

const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** #abc becomes #aabbcc, lowercase: video templates and the widget both accept the 6-digit form. */
export function normalizeHex(value: string): string {
  const v = value.trim().toLowerCase();
  return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
}

/**
 * One plain family name, as the site already uses it ("Poppins", "Open Sans"). Deliberately
 * stricter than the widget's own sanitiser (no lists, no quotes), so anything accepted here is
 * safe to put into CSS on a customer's site.
 */
export const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;

const color = (label: string) =>
  z
    .string()
    .trim()
    .regex(hex, `${label} must be a hex colour like #cf3d0b`)
    .transform(normalizeHex);

export const brandKitSchema = z
  .object({
    primaryColor: color("Primary colour"),
    accentColor: color("Accent colour").nullable().optional(),
    borderRadius: z.number().int("Radius must be a whole number").min(0).max(24).nullable().optional(),
    fontMode: z.enum(FONT_MODES),
    fontFamily: z.string().trim().regex(FONT_NAME, "Use the font name only, for example Poppins or Open Sans").nullable().optional(),
    inheritTextColor: z.boolean(),
    videoStyle: z.enum(BACKGROUND_STYLES).nullable().optional(),
    videoSecondaryColor: color("Second colour").nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fontMode === "custom" && !data.fontFamily) {
      ctx.addIssue({ code: "custom", path: ["fontFamily"], message: "Enter the name of the font your site uses" });
    }
  });

export type BrandKitInput = z.infer<typeof brandKitSchema>;
