import type { NextResponse } from "next/server";
import { and, asc, count, desc, eq, inArray, max, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces, widgetConfigs, widgetVersions } from "@/lib/db/schema";
import { apiError } from "@/lib/api/errors";
import { createNotification } from "@/lib/notifications/service";
import { layoutInfo } from "@/lib/widget-editor/layouts";
import { copyStyle } from "@/lib/widget-editor/copy-style";
import { MAX_VERSIONS, sameSettings } from "./history";
import { formatLimit } from "@/lib/payments/plan-limits";
import { getSubscriptionLimits } from "@/lib/payments/subscription";
import { DEFAULT_WIDGET_CONFIG, normalizeTheme, updateWidgetConfigSchema, type UpdateWidgetConfigInput } from "@/lib/validations/widget-config";

/**
 * A space can have several widgets (rows of `widget_configs`). Oldest first is the order everywhere:
 *
 * - the *primary* widget is the first one: what the plain embed snippet, `data-vouchreel-embed` and the
 *   editor's old single-widget routes mean;
 * - a widget is *live* when visitors can see it. Widgets that existed before there could be several are
 *   live; a new one starts off and goes live when the owner publishes it.
 */
export type WidgetRow = typeof widgetConfigs.$inferSelect;

const inOrder = [asc(widgetConfigs.sortOrder), asc(widgetConfigs.createdAt)] as const;

export async function listWidgets(spaceId: string): Promise<WidgetRow[]> {
  return db.select().from(widgetConfigs).where(eq(widgetConfigs.spaceId, spaceId)).orderBy(...inOrder);
}

export async function getWidget(spaceId: string, widgetId: string): Promise<WidgetRow | null> {
  const [row] = await db
    .select()
    .from(widgetConfigs)
    .where(and(eq(widgetConfigs.id, widgetId), eq(widgetConfigs.spaceId, spaceId)));
  return row ?? null;
}

/** The space's first widget, whether or not it is live. */
export async function getPrimaryWidget(spaceId: string): Promise<WidgetRow | null> {
  const [row] = await db.select().from(widgetConfigs).where(eq(widgetConfigs.spaceId, spaceId)).orderBy(...inOrder).limit(1);
  return row ?? null;
}

/** Widgets visitors see, in order. */
export async function getLiveWidgets(spaceId: string): Promise<WidgetRow[]> {
  return db
    .select()
    .from(widgetConfigs)
    .where(and(eq(widgetConfigs.spaceId, spaceId), eq(widgetConfigs.isLive, true)))
    .orderBy(...inOrder);
}

/**
 * The space's primary widget, created from the defaults (live, as the single widget always was) if the space
 * has none yet. Spaces made through the app get one at creation; this covers older spaces and direct inserts.
 */
export async function ensurePrimaryWidget(spaceId: string): Promise<WidgetRow> {
  const existing = await getPrimaryWidget(spaceId);
  if (existing) return existing;
  const [row] = await db.insert(widgetConfigs).values({ spaceId, ...DEFAULT_WIDGET_CONFIG }).returning();
  return row;
}

/** The widget an experiment changes: the first one visitors see, else the first one. */
export async function getExperimentTarget(spaceId: string): Promise<WidgetRow | null> {
  const [live] = await db
    .select()
    .from(widgetConfigs)
    .where(and(eq(widgetConfigs.spaceId, spaceId), eq(widgetConfigs.isLive, true)))
    .orderBy(...inOrder)
    .limit(1);
  return live ?? getPrimaryWidget(spaceId);
}

/** What a copy starts from: the live settings of the widget it copies (not its unpublished edits). */
function settingsOf(row: WidgetRow): UpdateWidgetConfigInput {
  return {
    template: row.template,
    position: row.position,
    theme: normalizeTheme(row.theme),
    triggerType: row.triggerType,
    triggerValue: (row.triggerValue as Record<string, unknown>) ?? DEFAULT_WIDGET_CONFIG.triggerValue,
    pagesIncluded: row.pagesIncluded?.length ? row.pagesIncluded : DEFAULT_WIDGET_CONFIG.pagesIncluded,
    pagesExcluded: row.pagesExcluded ?? [],
    autoplayPreview: row.autoplayPreview,
  };
}

/** A new widget, off until published: either from the defaults or a copy of another widget of the same space. */
export async function createWidget(spaceId: string, input: { name: string; copyOf?: WidgetRow }): Promise<WidgetRow> {
  const [{ top }] = await db.select({ top: max(widgetConfigs.sortOrder) }).from(widgetConfigs).where(eq(widgetConfigs.spaceId, spaceId));
  const settings = input.copyOf ? settingsOf(input.copyOf) : DEFAULT_WIDGET_CONFIG;
  const [row] = await db
    .insert(widgetConfigs)
    .values({ spaceId, ...settings, name: input.name, sortOrder: (top ?? -1) + 1, isLive: false })
    .returning();
  return row;
}

export async function renameWidget(spaceId: string, widgetId: string, name: string): Promise<WidgetRow | null> {
  const [row] = await db
    .update(widgetConfigs)
    .set({ name })
    .where(and(eq(widgetConfigs.id, widgetId), eq(widgetConfigs.spaceId, spaceId)))
    .returning();
  return row ?? null;
}

/** Turns a widget on or off for visitors without touching its settings. */
export async function setWidgetLive(spaceId: string, widgetId: string, isLive: boolean): Promise<WidgetRow | null> {
  const [row] = await db
    .update(widgetConfigs)
    .set({ isLive })
    .where(and(eq(widgetConfigs.id, widgetId), eq(widgetConfigs.spaceId, spaceId)))
    .returning();
  return row ?? null;
}

/** A widget can have its own page only if its layout sits in a page rather than floating in a corner. */
export function canHaveWall(template: WidgetRow["template"]): boolean {
  return layoutInfo(template).placement === "inline";
}

/** Turns the widget's own public page on or off. "not_inline" for a layout that floats in a corner. */
export async function setWallEnabled(spaceId: string, widgetId: string, enabled: boolean): Promise<WidgetRow | "not_inline" | null> {
  const widget = await getWidget(spaceId, widgetId);
  if (!widget) return null;
  if (enabled && !canHaveWall(widget.template)) return "not_inline";
  const [row] = await db.update(widgetConfigs).set({ wallEnabled: enabled }).where(eq(widgetConfigs.id, widgetId)).returning();
  return row ?? null;
}

/**
 * The widget behind a public page (/wall/{id}), with its space: only when the owner turned the page on and the
 * layout still sits in a page. Whether the widget is live on the owner's site does not matter.
 */
export async function getWallWidget(widgetId: string): Promise<{ widget: WidgetRow; space: { id: string; name: string; ownerId: string; embedKey: string } } | null> {
  const [row] = await db
    .select({ widget: widgetConfigs, space: { id: spaces.id, name: spaces.name, ownerId: spaces.ownerId, embedKey: spaces.embedKey } })
    .from(widgetConfigs)
    .innerJoin(spaces, eq(spaces.id, widgetConfigs.spaceId))
    .where(and(eq(widgetConfigs.id, widgetId), eq(widgetConfigs.wallEnabled, true)));
  return row && canHaveWall(row.widget.template) ? row : null;
}

/**
 * Deletes a widget. A space keeps at least one: with none, visitors would get the default widget instead of
 * the owner's choices, which is never what deleting meant.
 */
export async function deleteWidget(spaceId: string, widgetId: string): Promise<"deleted" | "last" | "not_found"> {
  const widgets = await listWidgets(spaceId);
  if (!widgets.some((w) => w.id === widgetId)) return "not_found";
  if (widgets.length <= 1) return "last";
  await db.delete(widgetConfigs).where(and(eq(widgetConfigs.id, widgetId), eq(widgetConfigs.spaceId, spaceId)));
  return "deleted";
}

/**
 * Remembers a change to what visitors see: the settings the widget had before (once, so the first change can be
 * undone too) and the ones it has now, unless they are the same as the last one kept. Keeps the newest
 * MAX_VERSIONS. History is a safety net: a failure here never stops the change itself.
 */
export async function recordVersion(before: WidgetRow, after: WidgetRow, source: "publish" | "experiment"): Promise<void> {
  try {
    const [latest] = await db.select().from(widgetVersions).where(eq(widgetVersions.widgetId, after.id)).orderBy(desc(widgetVersions.createdAt)).limit(1);
    const wasShown = before.isLive || before.publishedAt !== null;
    if (!latest && wasShown) {
      await db.insert(widgetVersions).values({ widgetId: after.id, config: settingsOf(before), source: "before", createdAt: new Date(Date.now() - 1000) });
    }
    const now = settingsOf(after);
    const last = latest ?? (wasShown ? { config: settingsOf(before) } : null);
    if (last && sameSettings(last.config, now)) return;
    await db.insert(widgetVersions).values({ widgetId: after.id, config: now, source });

    const keep = await db.select({ id: widgetVersions.id }).from(widgetVersions).where(eq(widgetVersions.widgetId, after.id)).orderBy(desc(widgetVersions.createdAt)).limit(MAX_VERSIONS);
    await db.delete(widgetVersions).where(and(eq(widgetVersions.widgetId, after.id), notInArray(widgetVersions.id, keep.map((k) => k.id))));
  } catch {
    // A missing history entry must never undo a publish
  }
}

/** The kept versions of a widget, newest first. */
export async function listVersions(widgetId: string) {
  return db.select().from(widgetVersions).where(eq(widgetVersions.widgetId, widgetId)).orderBy(desc(widgetVersions.createdAt)).limit(MAX_VERSIONS);
}

/** Makes the settings live: they replace the widget's, the draft is cleared, and the widget is switched on. The change is kept in the widget's history. */
export async function publishWidget(widgetId: string, data: UpdateWidgetConfigInput): Promise<WidgetRow> {
  const [before] = await db.select().from(widgetConfigs).where(eq(widgetConfigs.id, widgetId));
  const [row] = await db
    .update(widgetConfigs)
    .set({
      template: data.template,
      position: data.position,
      theme: data.theme,
      triggerType: data.triggerType,
      triggerValue: data.triggerValue,
      pagesIncluded: data.pagesIncluded,
      pagesExcluded: data.pagesExcluded,
      autoplayPreview: data.autoplayPreview,
      draftConfig: null,
      publishedAt: new Date(),
      isLive: true,
    })
    .where(eq(widgetConfigs.id, widgetId))
    .returning();
  if (before) await recordVersion(before, row, "publish");
  return row;
}

export async function saveDraft(widgetId: string, data: UpdateWidgetConfigInput): Promise<void> {
  await db.update(widgetConfigs).set({ draftConfig: data }).where(eq(widgetConfigs.id, widgetId));
}

export async function discardDraft(widgetId: string): Promise<void> {
  await db.update(widgetConfigs).set({ draftConfig: null }).where(eq(widgetConfigs.id, widgetId));
}

/** What copying a style onto a widget builds on: its unpublished draft if it has a valid one, else its live settings. */
function draftBase(row: WidgetRow): UpdateWidgetConfigInput {
  const draft = row.draftConfig ? updateWidgetConfigSchema.safeParse(row.draftConfig) : null;
  return draft?.success ? draft.data : settingsOf(row);
}

/**
 * Puts the look of `source` (its live settings) into the targets' drafts. Nothing goes live: each target shows
 * "Unpublished changes" until its owner publishes. Only widgets of spaces `userId` owns are touched; others are
 * skipped without saying whether they exist. Returns the targets that were updated.
 */
export async function copyStyleToWidgets(userId: string, source: WidgetRow, targets: { spaceId: string; widgetId: string }[]): Promise<{ spaceId: string; widgetId: string }[]> {
  const ids = [...new Set(targets.map((t) => t.widgetId))].filter((id) => id !== source.id);
  if (!ids.length) return [];
  const rows = await db
    .select({ widget: widgetConfigs })
    .from(widgetConfigs)
    .innerJoin(spaces, eq(spaces.id, widgetConfigs.spaceId))
    .where(and(inArray(widgetConfigs.id, ids), eq(spaces.ownerId, userId)));

  const asked = new Set(targets.map((t) => `${t.spaceId}:${t.widgetId}`));
  const done: { spaceId: string; widgetId: string }[] = [];
  for (const { widget } of rows) {
    if (!asked.has(`${widget.spaceId}:${widget.id}`)) continue; // the id exists, but not in the space that was named
    const base = draftBase(widget);
    await saveDraft(widget.id, { ...base, theme: copyStyle(source.theme, base.theme, base.template) });
    done.push({ spaceId: widget.spaceId, widgetId: widget.id });
  }
  return done;
}

/** Every widget of the user's spaces, grouped by space (the current space first), for choosing where to copy a style. */
export async function listCopyTargets(userId: string, currentSpaceId: string, exceptWidgetId: string) {
  const rows = await db
    .select({ spaceId: spaces.id, spaceName: spaces.name, widgetId: widgetConfigs.id, widgetName: widgetConfigs.name, template: widgetConfigs.template })
    .from(widgetConfigs)
    .innerJoin(spaces, eq(spaces.id, widgetConfigs.spaceId))
    .where(eq(spaces.ownerId, userId))
    .orderBy(asc(spaces.name), asc(widgetConfigs.sortOrder), asc(widgetConfigs.createdAt));
  const groups = new Map<string, { spaceId: string; spaceName: string; widgets: { id: string; name: string; template: WidgetRow["template"] }[] }>();
  for (const r of rows) {
    if (r.widgetId === exceptWidgetId) continue;
    const g = groups.get(r.spaceId) ?? { spaceId: r.spaceId, spaceName: r.spaceName, widgets: [] };
    g.widgets.push({ id: r.widgetId, name: r.widgetName, template: r.template });
    groups.set(r.spaceId, g);
  }
  return [...groups.values()].sort((a, b) => Number(b.spaceId === currentSpaceId) - Number(a.spaceId === currentSpaceId));
}

/** What the editor loads: the live settings, the unpublished draft (if still valid), and which widget this is. */
export function widgetView(row: WidgetRow, space: { id: string; name: string; embedKey: string }) {
  const { draftConfig, ...live } = row;
  const draft = draftConfig ? updateWidgetConfigSchema.safeParse(draftConfig) : null;
  return {
    widgetConfig: {
      ...live,
      template: row.template || DEFAULT_WIDGET_CONFIG.template,
      theme: normalizeTheme(row.theme),
      triggerValue: row.triggerValue && Object.keys(row.triggerValue).length > 0 ? row.triggerValue : DEFAULT_WIDGET_CONFIG.triggerValue,
      pagesIncluded: row.pagesIncluded && row.pagesIncluded.length > 0 ? row.pagesIncluded : DEFAULT_WIDGET_CONFIG.pagesIncluded,
    },
    // Unpublished edits, when there are any (and still valid), for the editor to resume
    draft: draft?.success ? { ...draft.data, theme: normalizeTheme(draft.data.theme) } : null,
    widget: { id: row.id, name: row.name, isLive: row.isLive, wallEnabled: row.wallEnabled, sortOrder: row.sortOrder, hasDraft: Boolean(draftConfig) },
    space,
  };
}

/** The list the widgets page shows: one summary per widget. */
export function widgetSummary(row: WidgetRow) {
  return {
    id: row.id,
    name: row.name,
    template: row.template,
    isLive: row.isLive,
    wallEnabled: row.wallEnabled,
    sortOrder: row.sortOrder,
    hasDraft: Boolean(row.draftConfig),
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
  };
}

export interface WidgetQuota {
  allowed: boolean;
  current: number;
  limit: number;
  ownerId: string;
}

/**
 * How many widgets a space may have. The limit comes from the space OWNER's plan, like testimonials. Only
 * creating one more is limited: after a downgrade, widgets over the limit keep running and stay editable.
 * Returns null when the space does not exist.
 */
export async function getWidgetQuota(spaceId: string): Promise<WidgetQuota | null> {
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return null;
  const [row] = await db.select({ value: count() }).from(widgetConfigs).where(eq(widgetConfigs.spaceId, spaceId));
  const limits = await getSubscriptionLimits(space.ownerId);
  const current = row?.value ?? 0;
  return { allowed: current < limits.maxWidgetsPerSpace, current, limit: limits.maxWidgetsPerSpace, ownerId: space.ownerId };
}

/** Guard for every path that adds a widget: a 403 PLAN_LIMIT response (and a once-a-day note to the owner), or null. */
export async function enforceWidgetLimit(spaceId: string): Promise<NextResponse | null> {
  const quota = await getWidgetQuota(spaceId);
  if (!quota || quota.allowed) return null;

  void createNotification({
    userId: quota.ownerId,
    type: "plan.limit_reached",
    title: "A space reached its widget limit",
    body: `Your plan allows ${formatLimit(quota.limit)} ${quota.limit === 1 ? "widget" : "widgets"} per space. Upgrade to add more.`,
    href: "/pricing",
    dedupeKey: `plan-limit:widgets:${spaceId}`,
  });

  return apiError(
    403,
    "PLAN_LIMIT",
    `Widget limit reached (${quota.current}/${formatLimit(quota.limit)}). Upgrade your plan to add more.`,
    { details: { current: quota.current, limit: Number.isFinite(quota.limit) ? quota.limit : null } }
  );
}
