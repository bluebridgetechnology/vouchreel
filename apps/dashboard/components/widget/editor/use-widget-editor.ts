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

/**
 * The widget editor's state: the draft being edited (with undo/redo), the published config it is compared
 * with, and saving. Every change autosaves as a draft; visitors keep the published widget until `publish`.
 */
export function useWidgetEditor(spaceId: string) {
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
      const res = await fetch(`/api/spaces/${spaceId}/widget-config`);
      if (!res.ok) throw new Error("Failed to load widget configuration");
      const data = await res.json();
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
  }, [spaceId]);

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
        const res = await fetch(`/api/spaces/${spaceId}/widget-config/draft`, {
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
  }, [config, loading, spaceId]);

  // Leaving the page inside the autosave delay still keeps the last change
  const latest = useRef(config);
  latest.current = config;
  useEffect(() => {
    return () => {
      if (savedDraft.current === null || same(latest.current, savedDraft.current)) return;
      fetch(`/api/spaces/${spaceId}/widget-config/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(latest.current),
        keepalive: true,
      }).catch(() => undefined);
    };
  }, [spaceId]);

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
      const res = await fetch(`/api/spaces/${spaceId}/widget-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Failed to publish the widget");
      setPublished(config);
      savedDraft.current = config;
      setSaveState("idle");
      return true;
    } finally {
      setPublishing(false);
    }
  }, [config, spaceId]);

  /** Back to what visitors see now. Undo still has the discarded edits. */
  const discard = useCallback(async () => {
    await fetch(`/api/spaces/${spaceId}/widget-config/draft`, { method: "DELETE" });
    savedDraft.current = published;
    setHistory((h) => pushHistory(h, published, "discard"));
    setSaveState("idle");
  }, [published, spaceId]);

  const unpublished = useMemo(() => !same(config, published), [config, published]);

  return {
    loading,
    error,
    reload: load,
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
