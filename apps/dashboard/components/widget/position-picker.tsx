"use client";

import { WidgetPosition } from "@/lib/validations/widget-config";
import { cn } from "@/lib/utils";
import { toggleStyle } from "@/components/ui/toggle";

interface PositionPickerProps {
  value: WidgetPosition;
  onChange: (position: WidgetPosition) => void;
}

interface PositionOption {
  id: WidgetPosition;
  name: string;
  tagline: string;
  description: string;
}

const POSITIONS: PositionOption[] = [
  {
    id: "bottom-right",
    name: "Bottom Right",
    tagline: "Floating badge (Default)",
    description: "Discrete floating video launcher in the lower right corner. Best for most marketing sites.",
  },
  {
    id: "bottom-left",
    name: "Bottom Left",
    tagline: "Floating badge (Left)",
    description: "Positioned in the lower left corner. Ideal if you already have a live chat widget on the right.",
  },
  {
    id: "bottom-bar",
    name: "Bottom Bar",
    tagline: "Full-width sticky bar",
    description: "Persistent horizontal notification bar docked to the bottom. Maximizes click-through rate.",
  },
  {
    id: "story-strip",
    name: "Story Strip",
    tagline: "Social stories style",
    description: "Instagram-style circular video avatar strip. Great for modern e-commerce and SaaS products.",
  },
];

export function PositionPicker({ value, onChange }: PositionPickerProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Widget Position</h3>
        <p className="text-xs text-muted-foreground">
          Choose where and how the video widget appears on your website pages.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {POSITIONS.map((pos) => {
          const isSelected = value === pos.id;

          return (
            <button
              key={pos.id}
              type="button"
              onClick={() => onChange(pos.id)}
              className={cn("group relative flex flex-col rounded-card border p-4 text-left transition-all", toggleStyle("choice", isSelected))}
            >
              {/* Wireframe Mockup */}
              <div className="mb-3 h-28 w-full overflow-hidden rounded-control border bg-muted/20 p-2.5">
                <div className="flex h-full flex-col justify-between rounded-control border border-dashed border-border/80 bg-background/90 p-2">
                  {/* Mock Browser Header */}
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-pill bg-danger" />
                      <div className="h-1.5 w-1.5 rounded-pill bg-warning" />
                      <div className="h-1.5 w-1.5 rounded-pill bg-success" />
                    </div>
                    <div className="h-1.5 w-16 rounded-pill bg-muted" />
                  </div>

                  {/* Mock Content Lines */}
                  <div className="space-y-1.5 py-1">
                    <div className="h-1.5 w-3/4 rounded-control bg-muted/80" />
                    <div className="h-1.5 w-1/2 rounded-control bg-muted/50" />
                  </div>

                  {/* Wireframe Position Highlight */}
                  {pos.id === "bottom-right" && (
                    <div className="flex justify-end">
                      <div className="flex items-center gap-1 rounded-pill bg-primary px-1.5 py-0.5 shadow-sm">
                        <div className="h-2 w-2 rounded-pill bg-primary-foreground animate-pulse" />
                        <span className="text-3xs font-medium text-primary-foreground">Video</span>
                      </div>
                    </div>
                  )}

                  {pos.id === "bottom-left" && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-1 rounded-pill bg-primary px-1.5 py-0.5 shadow-sm">
                        <div className="h-2 w-2 rounded-pill bg-primary-foreground animate-pulse" />
                        <span className="text-3xs font-medium text-primary-foreground">Video</span>
                      </div>
                    </div>
                  )}

                  {pos.id === "bottom-bar" && (
                    <div className="-mx-2 -mb-2 flex items-center justify-between rounded-b-md bg-primary px-2 py-1 shadow-sm">
                      <span className="text-3xs font-medium text-primary-foreground">
                        Customer Stories
                      </span>
                      <div className="h-2 w-5 rounded-pill bg-primary-foreground/30" />
                    </div>
                  )}

                  {pos.id === "story-strip" && (
                    <div className="-mx-1 -mb-1 flex items-center gap-1 rounded-control bg-muted/40 p-1">
                      <div className="h-3.5 w-3.5 rounded-pill border-2 border-primary bg-primary/20" />
                      <div className="h-3.5 w-3.5 rounded-pill border-2 border-primary bg-primary/20" />
                      <div className="h-3.5 w-3.5 rounded-pill border-2 border-primary/50 bg-primary/10" />
                    </div>
                  )}
                </div>
              </div>

              {/* Title and selection badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  {pos.name}
                </span>
                {isSelected ? (
                  <span className="inline-flex items-center rounded-pill bg-primary px-2 py-0.5 text-2xs font-medium text-primary-foreground">
                    Selected
                  </span>
                ) : (
                  <span className="text-2xs text-muted-foreground">
                    {pos.tagline}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="mt-1 text-2xs text-muted-foreground leading-relaxed">
                {pos.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
