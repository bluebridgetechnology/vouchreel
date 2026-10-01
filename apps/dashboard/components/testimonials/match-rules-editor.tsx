"use client";

import { useState } from "react";
import { MatchRules } from "@/lib/validations/testimonials";

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
    <div className="space-y-4 rounded-card border bg-muted/20 p-4">
      <div className="space-y-1">
        <span id="match-rules-label" className="block text-sm font-medium text-foreground">
          Contextual Page Matching Rules
        </span>
        <p className="text-xs text-muted-foreground">
          Control which pages on your website will display this testimonial.
        </p>
      </div>

      {/* Mode selection radio / segmented switch */}
      <div
        role="group"
        aria-labelledby="match-rules-label"
        className="grid grid-cols-2 gap-2 rounded-card border bg-muted/40 p-1"
      >
        <button
          type="button"
          onClick={() => setMode("all")}
          className={`rounded-control px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "all"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Show on all pages
        </button>
        <button
          type="button"
          onClick={() => setMode("specific")}
          className={`rounded-control px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "specific"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
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
              className="text-xs font-medium text-foreground"
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
                className="flex-1 rounded-control border bg-background px-3 py-1.5 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => handleAddPattern()}
                className="rounded-control border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Add
              </button>
            </div>
            {patternError && (
              <p className="text-2xs text-destructive">{patternError}</p>
            )}

            {urlPatterns.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {urlPatterns.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-control bg-background px-2 py-0.5 font-mono text-2xs font-medium border text-foreground"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => handleRemovePattern(p)}
                      aria-label={`Remove pattern ${p}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-2xs text-muted-foreground italic">
                No patterns added yet. Add patterns like <code>/pricing</code> or <code>/checkout/*</code>.
              </p>
            )}
          </div>

          {/* Tag matching */}
          <div className="space-y-2">
            <label
              htmlFor="match-tag-input"
              className="text-xs font-medium text-foreground"
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
                className="flex-1 rounded-control border bg-background px-3 py-1.5 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => handleAddTag()}
                className="rounded-control border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-control bg-secondary px-2 py-0.5 text-2xs font-medium text-secondary-foreground"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      aria-label={`Remove tag ${t}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Rule Preview */}
          <div className="rounded-control bg-background/80 border p-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Matching summary: </span>
            {urlPatterns.length === 0 && tags.length === 0 ? (
              <span>Will not match any specific page until patterns or tags are added.</span>
            ) : (
              <span>
                Displays on pages matching{" "}
                {urlPatterns.length > 0 && (
                  <span className="font-mono font-medium text-foreground">
                    {urlPatterns.join(", ")}
                  </span>
                )}
                {urlPatterns.length > 0 && tags.length > 0 && " or tags "}
                {tags.length > 0 && (
                  <span className="font-medium text-foreground">
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
