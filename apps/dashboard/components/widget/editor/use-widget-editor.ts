"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WIDGET_CONFIG, normalizeTheme, type UpdateWidgetConfigInput } from "@/lib/validations/widget-config";
import type { BrandKitValues } from "@/lib/brand-kit/theme";
import { createHistory, pushHistory, redo as redoHistory, undo as undoHistory, type History } from "@/lib/widget-editor/history";

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Edits are saved as a draft this long after the last change. */
const AUTOSAVE_MS = 800;

function fromApi(c: Record<string, unknown> | null | undefined): UpdateWidgetConfigInput {
  const d = DEFAULT_WIDGET_CONFIG;
  if (!c) return { ...d };
  return {
    template: (c.template as UpdateWidgetConfigInput["template"]) || d.template,
    position: (c.position as UpdateWidgetConfigInput["position"]) || d.position,
    theme: normalizeTheme(c.theme),
    triggerType: (c.triggerType as UpdateWidgetConfigInput["triggerType"]) || d.triggerType,
    triggerValue: (c.triggerValue as Record<string, unknown>) || d.triggerValue,
    pagesIncluded: (c.pagesIncluded as string[]) || d.pagesIncluded,
    pagesExcluded: (c.pagesExcluded as string[]) || d.pagesExcluded,
    autoplayPreview: (c.autoplayPreview as boolean | undefined) ?? d.autoplayPreview,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface EditedWidget {
  id: string;
  name: string;
  /** Whether visitors see it. A new widget is off until its first publish. */
  isLive: boolean;
  /** Whether the widget is also shown on its own public page. */
  wallEnabled: boolean;
}

/**
 * The state of the editor for one widget: the draft being edited (with undo/redo), the published config it is
 * compared with, and saving. Every change autosaves as a draft; visitors keep the published widget until
 * `publish` (which also turns a new widget on).
 */
export function useWidgetEditor(spaceId: string, widgetId: string) {
  const base = `/api/spaces/${spaceId}/widgets/${widgetId}`;
  const [widget, setWidget] = useState<EditedWidget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedKey, setEmbedKey] = useState("");
  const [brandKit, setBrandKit] = useState<BrandKitValues | null>(null);
  const [published, setPublished] = useState<UpdateWidgetConfigInput>(DEFAULT_WIDGET_CONFIG);
  const [history, setHistory] = useState<History<UpdateWidgetConfigInput>>(() => createHistory(DEFAULT_WIDGET_CONFIG));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  // What the server's draft holds, so autosave only runs when there is something new to save
  const savedDraft = useRef<UpdateWidgetConfigInput | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      fetch(`/api/spaces/${spaceId}/brand-kit`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setBrandKit(d?.saved ? d.values : null))
        .catch(() => undefined);
      const res = await fetch(base);
      if (res.status === 404) throw new Error("This widget no longer exists. It may have been deleted.");
      if (!res.ok) throw new Error("Failed to load widget configuration");
      const data = await res.json();
      setWidget({ id: data.widget.id, name: data.widget.name, isLive: data.widget.isLive, wallEnabled: Boolean(data.widget.wallEnabled) });
      const live = fromApi(data.widgetConfig);
      const draft = data.draft ? fromApi(data.draft) : null;
      setPublished(live);
      savedDraft.current = draft ?? live;
      setHistory(createHistory(draft ?? live));
      setEmbedKey(data.space?.embedKey ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load widget settings");
    } finally {
      setLoading(false);
    }
  }, [spaceId, base]);

  useEffect(() => {
    load();
  }, [load]);

  const config = history.present;

  // Autosave the draft
  useEffect(() => {
    if (loading || savedDraft.current === null || same(config, savedDraft.current)) return;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch(`${base}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error("Draft not saved");
        savedDraft.current = config;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [config, loading, base]);

  // Leaving the page inside the autosave delay still keeps the last change
  const latest = useRef(config);
  latest.current = config;
  useEffect(() => {
    return () => {
      if (savedDraft.current === null || same(latest.current, savedDraft.current)) return;
      fetch(`${base}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(latest.current),
        keepalive: true,
      }).catch(() => undefined);
    };
  }, [base]);

  /** Applies a change. `key` names the control, so a drag on one slider is one undo step. */
  const update = useCallback((patch: Partial<UpdateWidgetConfigInput>, key?: string) => {
    setHistory((h) => pushHistory(h, { ...h.present, ...patch }, key));
  }, []);

  const updateTheme = useCallback((patch: Partial<UpdateWidgetConfigInput["theme"]>, key?: string) => {
    setHistory((h) => pushHistory(h, { ...h.present, theme: { ...h.present.theme, ...patch } }, key));
  }, []);

  const undo = useCallback(() => setHistory(undoHistory), []);
  const redo = useCallback(() => setHistory(redoHistory), []);

  const publish = useCallback(async () => {
    setPublishing(true);
    try {
      const res = await fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Failed to publish the widget");
      setPublished(config);
      setWidget((w) => (w ? { ...w, isLive: true } : w));
      savedDraft.current = config;
      setSaveState("idle");
      return true;
    } finally {
      setPublishing(false);
    }
  }, [config, base]);

  /** Renames the widget. Throws with the server's message when the name is refused. */
  const rename = useCallback(
    async (name: string) => {
      const res = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.details?.name?.[0] || data?.error?.message || "Failed to rename the widget");
      setWidget((w) => (w ? { ...w, name: data.widget.name } : w));
    },
    [base]
  );

  /** Back to what visitors see now. Undo still has the discarded edits. */
  const discard = useCallback(async () => {
    await fetch(`${base}/draft`, { method: "DELETE" });
    savedDraft.current = published;
    setHistory((h) => pushHistory(h, published, "discard"));
    setSaveState("idle");
  }, [published, base]);

  const unpublished = useMemo(() => !same(config, published), [config, published]);

  return {
    loading,
    error,
    reload: load,
    widget,
    rename,
    embedKey,
    brandKit,
    config,
    published,
    unpublished,
    saveState,
    publishing,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    update,
    updateTheme,
    undo,
    redo,
    publish,
    discard,
  };
}
