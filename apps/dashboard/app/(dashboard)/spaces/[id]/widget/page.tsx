"use client";

import { use, useEffect, useState } from "react";
import {
  DEFAULT_WIDGET_CONFIG,
  UpdateWidgetConfigInput,
  WidgetPosition,
  WidgetTemplate,
  WidgetTheme,
  TriggerType,
} from "@/lib/validations/widget-config";
import { TemplatePicker } from "@/components/widget/template-picker";
import { PositionPicker } from "@/components/widget/position-picker";
import { ThemeEditor } from "@/components/widget/theme-editor";
import { TriggerConfig } from "@/components/widget/trigger-config";
import { PageTargeting } from "@/components/widget/page-targeting";
import { LivePreview } from "@/components/widget/live-preview";
import { EmbedSnippet } from "@/components/widget/embed-snippet";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { toggleStyle } from "@/components/ui/toggle";

interface WidgetPageProps {
  params: Promise<{ id: string }>;
}

export default function SpaceWidgetPage({ params }: WidgetPageProps) {
  const { id: spaceId } = use(params);

  // Widget config state
  const [config, setConfig] = useState<UpdateWidgetConfigInput>(DEFAULT_WIDGET_CONFIG);
  const [embedKey, setEmbedKey] = useState<string>("");

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Active section tab for mobile/clean navigation
  const [activeTab, setActiveTab] = useState<"appearance" | "triggers" | "targeting" | "embed">("appearance");

  async function fetchWidgetConfig() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/spaces/${spaceId}/widget-config`);
      if (!res.ok) {
        throw new Error("Failed to load widget configuration");
      }

      const data = await res.json();
      if (data.widgetConfig) {
        setConfig({
          template: data.widgetConfig.template || DEFAULT_WIDGET_CONFIG.template,
          position: data.widgetConfig.position || DEFAULT_WIDGET_CONFIG.position,
          theme: data.widgetConfig.theme || DEFAULT_WIDGET_CONFIG.theme,
          triggerType: data.widgetConfig.triggerType || DEFAULT_WIDGET_CONFIG.triggerType,
          triggerValue: data.widgetConfig.triggerValue || DEFAULT_WIDGET_CONFIG.triggerValue,
          pagesIncluded: data.widgetConfig.pagesIncluded || DEFAULT_WIDGET_CONFIG.pagesIncluded,
          pagesExcluded: data.widgetConfig.pagesExcluded || DEFAULT_WIDGET_CONFIG.pagesExcluded,
          autoplayPreview: data.widgetConfig.autoplayPreview ?? DEFAULT_WIDGET_CONFIG.autoplayPreview,
        });
      }

      if (data.space?.embedKey) {
        setEmbedKey(data.space.embedKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load widget settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWidgetConfig();
  }, [spaceId]);

  function handleTemplateChange(template: WidgetTemplate) {
    setConfig((prev) => ({ ...prev, template }));
    setIsDirty(true);
  }

  function handlePositionChange(position: WidgetPosition) {
    setConfig((prev) => ({ ...prev, position }));
    setIsDirty(true);
  }

  function handleThemeChange(theme: WidgetTheme) {
    setConfig((prev) => ({ ...prev, theme }));
    setIsDirty(true);
  }

  function handleTriggerChange(triggerType: TriggerType, triggerValue: Record<string, unknown>) {
    setConfig((prev) => ({ ...prev, triggerType, triggerValue }));
    setIsDirty(true);
  }

  function handleTargetingChange(pagesIncluded: string[], pagesExcluded: string[]) {
    setConfig((prev) => ({ ...prev, pagesIncluded, pagesExcluded }));
    setIsDirty(true);
  }

  function handleAutoplayChange(autoplayPreview: boolean) {
    setConfig((prev) => ({ ...prev, autoplayPreview }));
    setIsDirty(true);
  }

  function handleResetDefaults() {
    if (window.confirm("Reset all widget customizations to the default settings?")) {
      setConfig(DEFAULT_WIDGET_CONFIG);
      setIsDirty(true);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/widget-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to update widget settings");
      }

      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save widget settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-control bg-muted" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="h-48 animate-pulse rounded-card border bg-muted/40" />
            <div className="h-48 animate-pulse rounded-card border bg-muted/40" />
          </div>
          <div className="h-96 animate-pulse rounded-card border bg-muted/40 lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-card border border-destructive/20 bg-destructive/5 p-6 text-center">
        <h3 className="text-sm font-medium text-destructive">Error Loading Widget Settings</h3>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <button
          onClick={() => fetchWidgetConfig()}
          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-4")}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header & Save Status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              Widget Customization
            </h2>
            {isDirty && (
              <span className="rounded-pill bg-warning-soft px-2 py-0.5 text-2xs font-medium text-warning-foreground border border-warning/30">
                Unsaved changes
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Configure how your video widget displays, responds to visitor actions, and targets pages.
          </p>
        </div>

        {/* Global Save Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={buttonVariants({ variant: "primary", size: "sm" })}
          >
            {saving ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-pill border-2 border-primary-foreground border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Success / Error Banners */}
      {saveSuccess && (
        <div className="flex items-center justify-between rounded-card border border-success/30 bg-success-soft p-3.5 text-xs text-success-foreground">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Widget configuration saved successfully! Your live visitors will see the updated widget instantly.</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(false)}
            className={buttonVariants({ variant: "link-success", size: "bare" })}
          >
            ✕
          </button>
        </div>
      )}

      {saveError && (
        <div className="flex items-center justify-between rounded-card border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className={buttonVariants({ variant: "link-danger", size: "bare" })}
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation tabs for mobile / easy jumping */}
      <div className="flex border-b border-border sm:hidden">
        {[
          { id: "appearance", label: "Appearance" },
          { id: "triggers", label: "Triggers" },
          { id: "targeting", label: "Targeting" },
          { id: "embed", label: "Embed Code" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={cn("flex-1 py-2 text-center text-xs font-medium", toggleStyle("tab", activeTab === tab.id))}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Two-Column Responsive Layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Settings Form */}
        <div className="space-y-8 lg:col-span-7">
          {/* Section 0: Template Picker */}
          <div className={`${activeTab === "appearance" ? "block" : "hidden sm:block"}`}>
            <TemplatePicker
              value={config.template}
              onChange={handleTemplateChange}
            />
          </div>

          {/* Section 1: Position Picker */}
          <div className={`${activeTab === "appearance" ? "block" : "hidden sm:block"}`}>
            <PositionPicker
              value={config.position}
              onChange={handlePositionChange}
            />
          </div>

          {/* Section 2: Theme Editor */}
          <div className={`${activeTab === "appearance" ? "block" : "hidden sm:block"}`}>
            <ThemeEditor
              value={config.theme}
              onChange={handleThemeChange}
            />
          </div>

          {/* Section 3: Trigger Configuration */}
          <div className={`${activeTab === "triggers" ? "block" : "hidden sm:block"}`}>
            <TriggerConfig
              triggerType={config.triggerType}
              triggerValue={config.triggerValue}
              onChange={handleTriggerChange}
            />
          </div>

          {/* Section 4: Page Targeting */}
          <div className={`${activeTab === "targeting" ? "block" : "hidden sm:block"}`}>
            <PageTargeting
              pagesIncluded={config.pagesIncluded}
              pagesExcluded={config.pagesExcluded}
              onChange={handleTargetingChange}
            />
          </div>

          {/* Sticky / In-page Save Prompt */}
          <div className="flex items-center justify-between rounded-card border bg-card p-4 shadow-sm">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">
                {isDirty ? "Unsaved changes pending" : "All changes up to date"}
              </span>
              <p className="text-2xs text-muted-foreground">
                {isDirty
                  ? "Remember to save your settings to update the production widget."
                  : "Last configuration synced with database."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>

          {/* Section 5: Embed Snippet Generator */}
          <div className={`${activeTab === "embed" ? "block" : "hidden sm:block"}`}>
            {embedKey ? (
              <EmbedSnippet embedKey={embedKey} />
            ) : (
              <div className="h-40 animate-pulse rounded-card border bg-muted/30" />
            )}
          </div>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-6">
            <LivePreview
              template={config.template}
              position={config.position}
              theme={config.theme}
              triggerType={config.triggerType}
              triggerValue={config.triggerValue}
              autoplayPreview={config.autoplayPreview}
              onAutoplayChange={handleAutoplayChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
