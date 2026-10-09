"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { applyBrandKitToTheme } from "@/lib/brand-kit/theme";
import { layoutInfo, shapeForLayout } from "@/lib/widget-editor/layouts";
import { matchingPreset } from "@/lib/widget-editor/presets";
import { normalizeTheme } from "@/lib/validations/widget-config";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm";
import { LivePreview } from "@/components/widget/live-preview";
import { useWidgetEditor, type SaveState } from "@/components/widget/editor/use-widget-editor";
import { WidgetName } from "@/components/widget/editor/widget-name";
import { PerformancePanel } from "@/components/widget/editor/performance-panel";
import { HistoryDialog } from "@/components/widget/editor/history-dialog";
import { BehaviourSection, ContentSection, EditorSection, InstallSection, LayoutSection, SHAPE_LABELS, ShapeSection, StyleSection } from "@/components/widget/editor/sections";

interface WidgetPageProps {
  params: Promise<{ id: string; widgetId: string }>;
}

type SectionId = "layout" | "style" | "shape" | "content" | "behaviour" | "install";

function StatusPill({ isLive, unpublished, saveState }: { isLive: boolean; unpublished: boolean; saveState: SaveState }) {
  const [text, tone] =
    saveState === "error"
      ? ["Draft not saved", "bg-danger-soft text-danger-foreground"]
      : saveState === "saving"
        ? ["Saving draft…", "bg-surface-sunken text-text-muted"]
        : !isLive
          ? ["Not live", "bg-info-soft text-info-foreground"]
          : unpublished
            ? ["Unpublished changes", "bg-warning-soft text-warning-foreground"]
            : ["Published", "bg-success-soft text-success-foreground"];
  return (
    <span role="status" className={cn("inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-2xs font-medium", tone)}>
      {isLive && !unpublished && saveState !== "error" && <Icon name="cloud-check" size="sm" />}
      {text}
    </span>
  );
}

/**
 * The widget editor: settings on the left in steps, the real widget on the right. Every change shows at once
 * and autosaves as a draft; visitors keep the published widget until Publish.
 */
export default function SpaceWidgetPage({ params }: WidgetPageProps) {
  const { id: spaceId, widgetId } = use(params);
  const confirm = useConfirm();
  const editor = useWidgetEditor(spaceId, widgetId);
  const { config, update, updateTheme, undo, redo } = editor;
  const [open, setOpen] = useState<Set<SectionId>>(() => new Set(["layout"]));
  // The last look picked this session, so the editor can say "Glass (edited)" after a tweak
  const [lastPresetId, setLastPresetId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const toggle = (s: SectionId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z (or Ctrl+Y), except while typing in a text field, which has its own undo
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input[type=text], input:not([type]), textarea, [contenteditable=true]")) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    },
    [undo, redo]
  );
  useEffect(() => {
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onKey]);

  async function handlePublish() {
    try {
      const wasLive = editor.widget?.isLive ?? true;
      await editor.publish();
      notify.success(wasLive ? "Widget published" : "Widget is live", { description: "Visitors see it from their next page load." });
    } catch (err) {
      notify.fromError(err, "Failed to publish the widget");
    }
  }

  async function handleDiscard() {
    if (!(await confirm({ title: "Discard unpublished changes?", description: "The editor goes back to the widget visitors see now. You can still undo this.", confirmLabel: "Discard changes", tone: "default" }))) return;
    await editor.discard();
  }

  if (editor.loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="h-[560px] animate-pulse rounded-card border bg-surface-sunken/40" />
        <div className="h-[560px] animate-pulse rounded-card border bg-surface-sunken/40" />
      </div>
    );
  }

  if (editor.error) {
    return (
      <div className="rounded-card border border-danger/20 bg-danger-soft p-6 text-center">
        <h3 className="text-sm font-medium text-danger-foreground">Could not load the widget</h3>
        <p className="mt-1 text-xs text-text-muted">{editor.error}</p>
        <button onClick={() => editor.reload()} className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-4")}>
          Try again
        </button>
      </div>
    );
  }

  const theme = normalizeTheme(config.theme);
  const brandManaged = Boolean(editor.brandKit);
  const layout = layoutInfo(config.template);
  const iconButton = cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-2");
  const isLive = editor.widget?.isLive ?? true;

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-text-muted">
        <Link href={`/spaces/${spaceId}/widget`} className="inline-flex items-center gap-1 hover:text-text">
          <Icon name="arrow-left" size="sm" /> All widgets
        </Link>
      </nav>

      {/* Top bar: one save control for the whole editor */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/95 px-3 py-2.5 shadow-xs backdrop-blur">
        <div className="flex items-center gap-3">
          {editor.widget && <WidgetName name={editor.widget.name} onRename={editor.rename} />}
          <StatusPill isLive={isLive} unpublished={editor.unpublished} saveState={editor.saveState} />
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={undo} disabled={!editor.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)" className={iconButton}>
            <Icon name="undo-left" size="sm" />
          </button>
          <button type="button" onClick={redo} disabled={!editor.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" className={iconButton}>
            <Icon name="undo-right" size="sm" />
          </button>
          <button type="button" onClick={() => setHistoryOpen(true)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <Icon name="clock-circle" size="sm" /> History
          </button>
          {editor.unpublished && (
            <button type="button" onClick={handleDiscard} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Discard
            </button>
          )}
          <Button type="button" size="sm" onClick={handlePublish} disabled={(isLive && !editor.unpublished) || editor.publishing} loading={editor.publishing}>
            {editor.publishing ? "Publishing…" : isLive ? "Publish" : "Go live"}
          </Button>
        </div>
      </div>

      <PerformancePanel spaceId={spaceId} widgetId={widgetId} />

      {historyOpen && (
        <HistoryDialog
          url={`/api/spaces/${spaceId}/widgets/${widgetId}/versions`}
          onRestore={(restored) => {
            editor.replaceConfig(restored);
            notify.success("Version loaded", { description: "It is in the editor as unpublished changes. Publish to put it on your site, or Undo to go back." });
          }}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Preview first on phones, beside the panel on wide screens */}
        <div className="lg:order-2">
          <div className="lg:sticky lg:top-20">
            <LivePreview
              embedKey={editor.embedKey || undefined}
              template={config.template}
              position={config.position}
              theme={applyBrandKitToTheme(theme, editor.brandKit)}
              triggerType={config.triggerType}
              triggerValue={config.triggerValue}
              autoplayPreview={config.autoplayPreview}
              className="h-[min(78vh,760px)]"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-card border bg-surface lg:order-1">
          <EditorSection step={1} title="Layout" summary={layout.name} open={open.has("layout")} onToggle={() => toggle("layout")}>
            <LayoutSection value={config.template} onChange={(template) => update({ template, theme: { ...config.theme, shape: shapeForLayout(theme.shape, template) } })} />
          </EditorSection>
          <EditorSection step={2} title="Style" summary={matchingPreset(theme)?.name ?? `${theme.mode === "dark" ? "Dark" : "Light"}, ${theme.shadow} shadow${theme.glass ? ", glass" : ""}`} open={open.has("style")} onToggle={() => toggle("style")}>
            <StyleSection theme={theme} updateTheme={updateTheme} brandManaged={brandManaged} brandHref={`/spaces/${spaceId}/brand`} lastPresetId={lastPresetId} onPreset={setLastPresetId} />
          </EditorSection>
          <EditorSection step={3} title="Shape and size" summary={`${theme.shape ? SHAPE_LABELS[theme.shape] : "Default shape"}, ${{ sm: "small", md: "medium", lg: "large" }[theme.size]}`} open={open.has("shape")} onToggle={() => toggle("shape")}>
            <ShapeSection theme={theme} updateTheme={updateTheme} brandManaged={brandManaged} template={config.template} />
          </EditorSection>
          <EditorSection step={4} title="Content" summary="What each card shows" open={open.has("content")} onToggle={() => toggle("content")}>
            <ContentSection theme={theme} updateTheme={updateTheme} template={config.template} />
          </EditorSection>
          <EditorSection step={5} title="Behaviour" summary="When and where it appears" open={open.has("behaviour")} onToggle={() => toggle("behaviour")}>
            <BehaviourSection config={config} update={update} />
          </EditorSection>
          <EditorSection step={6} title="Install" summary="Add it to your site" open={open.has("install")} onToggle={() => toggle("install")}>
            <InstallSection spaceId={spaceId} embedKey={editor.embedKey} template={config.template} widgetId={widgetId} wallEnabled={editor.widget?.wallEnabled} />
          </EditorSection>
        </div>
      </div>
    </div>
  );
}
