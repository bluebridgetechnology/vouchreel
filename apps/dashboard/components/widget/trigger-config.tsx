"use client";

import { TriggerType } from "@/lib/validations/widget-config";

interface TriggerConfigProps {
  triggerType: TriggerType;
  triggerValue: Record<string, unknown>;
  onChange: (type: TriggerType, value: Record<string, unknown>) => void;
}

interface TriggerMeta {
  id: TriggerType;
  label: string;
  description: string;
}

const TRIGGER_OPTIONS: TriggerMeta[] = [
  {
    id: "delay",
    label: "Time Delay",
    description: "Displays the widget after the visitor has spent a specified number of seconds on the page.",
  },
  {
    id: "exit-intent",
    label: "Exit Intent",
    description: "Detects when the visitor moves their cursor to leave the page or switch tabs, catching them before they bounce.",
  },
  {
    id: "scroll-depth",
    label: "Scroll Depth",
    description: "Shows the widget once the user scrolls past a specific percentage of the page content.",
  },
  {
    id: "pageview-count",
    label: "Pageview Count",
    description: "Displays the widget on or after a visitor has browsed a target number of pages in their session.",
  },
  {
    id: "returning-visitor",
    label: "Returning Visitor",
    description: "Only triggers for visitors who have been to your website previously, providing social proof to repeat shoppers.",
  },
];

export function TriggerConfig({
  triggerType,
  triggerValue,
  onChange,
}: TriggerConfigProps) {
  function handleTypeSelect(newType: TriggerType) {
    let defaultValue: Record<string, unknown> = {};
    if (newType === "delay") {
      defaultValue = { seconds: Number(triggerValue.seconds) || 5 };
    } else if (newType === "scroll-depth") {
      defaultValue = { percentage: Number(triggerValue.percentage) || 50 };
    } else if (newType === "pageview-count") {
      defaultValue = { count: Number(triggerValue.count) || 2 };
    }
    onChange(newType, defaultValue);
  }

  function handleValueUpdate(field: string, val: unknown) {
    onChange(triggerType, {
      ...triggerValue,
      [field]: val,
    });
  }

  const currentMeta =
    TRIGGER_OPTIONS.find((t) => t.id === triggerType) || TRIGGER_OPTIONS[0];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Behavior & Triggers</h3>
        <p className="text-xs text-muted-foreground">
          Define when and how the widget should present itself to website visitors.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        {/* Trigger Selection Dropdown */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Trigger Event
          </label>
          <select
            value={triggerType}
            onChange={(e) => handleTypeSelect(e.target.value as TriggerType)}
            className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TRIGGER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Informational Callout */}
        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{currentMeta.label}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed">{currentMeta.description}</p>
        </div>

        {/* Dynamic Parameter Forms */}
        {triggerType === "delay" && (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Delay Duration (Seconds)
              </label>
              <span className="font-mono text-xs font-semibold text-primary">
                {Number(triggerValue.seconds) || 5}s
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={Number(triggerValue.seconds) || 5}
                onChange={(e) =>
                  handleValueUpdate("seconds", Math.max(1, Number(e.target.value)))
                }
                className="w-full accent-primary cursor-pointer"
              />
              <input
                type="number"
                min={1}
                max={300}
                value={Number(triggerValue.seconds) || 5}
                onChange={(e) =>
                  handleValueUpdate("seconds", Math.max(1, Number(e.target.value)))
                }
                className="w-16 rounded-md border bg-background px-2 py-1 text-center font-mono text-xs focus:border-primary focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Recommended: 3–10 seconds to give visitors time to scan your headline.
            </p>
          </div>
        )}

        {triggerType === "scroll-depth" && (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Scroll Percentage
              </label>
              <span className="font-mono text-xs font-semibold text-primary">
                {Number(triggerValue.percentage) || 50}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={Number(triggerValue.percentage) || 50}
                onChange={(e) =>
                  handleValueUpdate("percentage", Math.max(1, Math.min(100, Number(e.target.value))))
                }
                className="w-full accent-primary cursor-pointer"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={Number(triggerValue.percentage) || 50}
                onChange={(e) =>
                  handleValueUpdate("percentage", Math.max(1, Math.min(100, Number(e.target.value))))
                }
                className="w-16 rounded-md border bg-background px-2 py-1 text-center font-mono text-xs focus:border-primary focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Triggers when user reaches this percentage of the total page height.
            </p>
          </div>
        )}

        {triggerType === "pageview-count" && (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Pageviews Before Trigger
              </label>
              <span className="font-mono text-xs font-semibold text-primary">
                {Number(triggerValue.count) || 2} views
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={Number(triggerValue.count) || 2}
                onChange={(e) =>
                  handleValueUpdate("count", Math.max(1, Number(e.target.value)))
                }
                className="w-full accent-primary cursor-pointer"
              />
              <input
                type="number"
                min={1}
                max={50}
                value={Number(triggerValue.count) || 2}
                onChange={(e) =>
                  handleValueUpdate("count", Math.max(1, Number(e.target.value)))
                }
                className="w-16 rounded-md border bg-background px-2 py-1 text-center font-mono text-xs focus:border-primary focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Waits until the visitor has browsed through at least this many pages.
            </p>
          </div>
        )}

        {triggerType === "exit-intent" && (
          <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
            <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>No additional configuration needed. Exit intent fires automatically on mouseleave to the top browser bar.</span>
          </div>
        )}

        {triggerType === "returning-visitor" && (
          <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
            <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>No additional configuration needed. Returning visitors are recognized across sessions via local cookies.</span>
          </div>
        )}
      </div>
    </div>
  );
}
