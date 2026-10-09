import type { UpdateWidgetConfigInput } from "@/lib/validations/widget-config";
import { normalizeTheme } from "@/lib/validations/widget-config";

/** How many versions of a widget are kept. */
export const MAX_VERSIONS = 10;

/** JSON with object keys sorted, so two settings that mean the same compare equal however the database ordered them. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export const sameSettings = (a: unknown, b: unknown) => canonical(a) === canonical(b);

const COLOUR = ["primaryColor", "accentColor", "background", "textColor", "borderColor", "mode"] as const;
const CONTENT = ["showName", "showCompany", "showStars", "showSource", "showQuote"] as const;
const SPACING = ["columns", "gap", "autoAdvance"] as const;

/**
 * What changed between two versions of a widget, in the owner's words ("Layout", "Colours"...), for the history
 * list. Empty when nothing the owner would notice differs.
 */
export function changedAreas(before: UpdateWidgetConfigInput, after: UpdateWidgetConfigInput): string[] {
  const a = normalizeTheme(before.theme) as Record<string, unknown>;
  const b = normalizeTheme(after.theme) as Record<string, unknown>;
  const differs = (keys: readonly string[]) => keys.some((k) => !sameSettings(a[k], b[k]));
  const grouped = new Set<string>([...COLOUR, ...CONTENT, ...SPACING]);

  const out: string[] = [];
  if (before.template !== after.template) out.push("Layout");
  if (differs(COLOUR)) out.push("Colours");
  if (differs(Object.keys(a).filter((k) => !grouped.has(k)))) out.push("Look");
  if (differs(CONTENT)) out.push("What it shows");
  if (differs(SPACING)) out.push("Columns and spacing");
  if (before.position !== after.position) out.push("Position");
  if (!sameSettings({ t: before.triggerType, v: before.triggerValue }, { t: after.triggerType, v: after.triggerValue })) out.push("Timing");
  if (!sameSettings([before.pagesIncluded, before.pagesExcluded], [after.pagesIncluded, after.pagesExcluded])) out.push("Pages");
  if (before.autoplayPreview !== after.autoplayPreview) out.push("Autoplay");
  return out;
}

/** The line a version gets in the history list: what it was, and what it changed. */
export function versionSummary(source: "publish" | "experiment" | "before", changed: string[] | null): string {
  if (source === "before") return "How it was before history began";
  const what = changed === null ? "" : changed.length ? `Changed: ${changed.join(", ").toLowerCase()}` : "No visible change";
  const how = source === "experiment" ? "Experiment winner" : "Published";
  return what ? `${how}. ${what}` : how;
}
