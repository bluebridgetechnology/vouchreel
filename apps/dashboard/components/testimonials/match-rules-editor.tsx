"use client";

import { useState } from "react";
import { MatchRules } from "@/lib/validations/testimonials";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";

interface MatchRulesEditorProps {
  value: MatchRules;
  onChange: (rules: MatchRules) => void;
}

export function MatchRulesEditor({ value, onChange }: MatchRulesEditorProps) {
  const [newPattern, setNewPattern] = useState("");
  const [newTag, setNewTag] = useState("");
  const [patternError, setPatternError] = useState<string | null>(null);

  const mode = value.mode || "all";
  const urlPatterns = value.urlPatterns || [];
  const tags = value.tags || [];

  function setMode(newMode: "all" | "specific") {
    onChange({
      ...value,
      mode: newMode,
    });
  }

  function handleAddPattern(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = newPattern.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith("/") && !trimmed.startsWith("http")) {
      setPatternError("Pattern should start with / (e.g., /products/* or /pricing)");
      return;
    }

    if (urlPatterns.includes(trimmed)) {
      setPatternError("Pattern already added");
      return;
    }

    setPatternError(null);
    onChange({
      ...value,
      urlPatterns: [...urlPatterns, trimmed],
    });
    setNewPattern("");
  }

  function handleRemovePattern(pattern: string) {
    onChange({
      ...value,
      urlPatterns: urlPatterns.filter((p) => p !== pattern),
    });
  }

  function handleAddTag(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;

    onChange({
      ...value,
      tags: [...tags, trimmed],
    });
    setNewTag("");
  }

  function handleRemoveTag(tag: string) {
    onChange({
      ...value,
      tags: tags.filter((t) => t !== tag),
    });
  }

  return (
    <div className="space-y-4 rounded-card border bg-surface-sunken/20 p-4">
      <div className="space-y-1">
        <span id="match-rules-label" className="block text-sm font-medium text-text">
          Contextual Page Matching Rules
        </span>
        <p className="text-xs text-text-muted">
          Control which pages on your website will display this testimonial.
        </p>
      </div>

      {/* Mode selection radio / segmented switch */}
      <div
        role="group"
        aria-labelledby="match-rules-label"
        className="grid grid-cols-2 gap-2 rounded-card border bg-surface-sunken/40 p-1"
      >
        <button
          type="button"
          onClick={() => setMode("all")}
          className={cn("rounded-control px-3 py-1.5 text-xs font-medium transition-all", toggleStyle("raised", mode === "all"))}
        >
          Show on all pages
        </button>
        <button
          type="button"
          onClick={() => setMode("specific")}
          className={cn("rounded-control px-3 py-1.5 text-xs font-medium transition-all", toggleStyle("raised", mode === "specific"))}
        >
          Show on specific pages
        </button>
      </div>

      {/* Specific pages rule editor */}
      {mode === "specific" && (
        <div className="space-y-4 pt-2">
          {/* URL Patterns */}
          <div className="space-y-2">
            <label
              htmlFor="match-url-pattern-input"
              className="text-xs font-medium text-text"
            >
              URL Patterns (Glob syntax)
            </label>
            <div className="flex gap-2">
              <input
                id="match-url-pattern-input"
                type="text"
                value={newPattern}
                onChange={(e) => {
                  setNewPattern(e.target.value);
                  setPatternError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPattern();
                  }
                }}
                placeholder="e.g. /products/*, /pricing"
                className={cn(inputClass, "flex-1 text-xs")}
              />
              <button
                type="button"
                onClick={() => handleAddPattern()}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Add
              </button>
            </div>
            {patternError && (
              <p className="text-2xs text-danger-foreground">{patternError}</p>
            )}

            {urlPatterns.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {urlPatterns.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-control bg-surface px-2 py-0.5 font-mono text-2xs font-medium border text-text"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => handleRemovePattern(p)}
                      aria-label={`Remove pattern ${p}`}
                      className={buttonVariants({ variant: "ghost-danger", size: "bare" })}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-2xs text-text-muted italic">
                No patterns added yet. Add patterns like <code>/pricing</code> or <code>/checkout/*</code>.
              </p>
            )}
          </div>

          {/* Tag matching */}
          <div className="space-y-2">
            <label
              htmlFor="match-tag-input"
              className="text-xs font-medium text-text"
            >
              Match by Page Tags (Optional)
            </label>
            <div className="flex gap-2">
              <input
                id="match-tag-input"
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="e.g. enterprise, checkout, product-a"
                className={cn(inputClass, "flex-1 text-xs")}
              />
              <button
                type="button"
                onClick={() => handleAddTag()}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-control bg-surface-sunken px-2 py-0.5 text-2xs font-medium text-text"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      aria-label={`Remove tag ${t}`}
                      className={buttonVariants({ variant: "ghost-danger", size: "bare" })}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Rule Preview */}
          <div className="rounded-control bg-canvas/80 border p-2.5 text-xs text-text-muted">
            <span className="font-medium text-text">Matching summary: </span>
            {urlPatterns.length === 0 && tags.length === 0 ? (
              <span>Will not match any specific page until patterns or tags are added.</span>
            ) : (
              <span>
                Displays on pages matching{" "}
                {urlPatterns.length > 0 && (
                  <span className="font-mono font-medium text-text">
                    {urlPatterns.join(", ")}
                  </span>
                )}
                {urlPatterns.length > 0 && tags.length > 0 && " or tags "}
                {tags.length > 0 && (
                  <span className="font-medium text-text">
                    [{tags.join(", ")}]
                  </span>
                )}
                .
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
