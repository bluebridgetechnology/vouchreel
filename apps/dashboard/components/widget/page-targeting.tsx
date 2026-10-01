"use client";

import { useState } from "react";

interface PageTargetingProps {
  pagesIncluded: string[];
  pagesExcluded: string[];
  onChange: (included: string[], excluded: string[]) => void;
}

export function PageTargeting({
  pagesIncluded,
  pagesExcluded,
  onChange,
}: PageTargetingProps) {
  const [includeInput, setIncludeInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");

  function handleAddInclude() {
    const trimmed = includeInput.trim();
    if (!trimmed) return;
    if (!pagesIncluded.includes(trimmed)) {
      onChange([...pagesIncluded, trimmed], pagesExcluded);
    }
    setIncludeInput("");
  }

  function handleRemoveInclude(pattern: string) {
    onChange(
      pagesIncluded.filter((p) => p !== pattern),
      pagesExcluded
    );
  }

  function handleAddExclude() {
    const trimmed = excludeInput.trim();
    if (!trimmed) return;
    if (!pagesExcluded.includes(trimmed)) {
      onChange(pagesIncluded, [...pagesExcluded, trimmed]);
    }
    setExcludeInput("");
  }

  function handleRemoveExclude(pattern: string) {
    onChange(
      pagesIncluded,
      pagesExcluded.filter((p) => p !== pattern)
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Page Targeting</h3>
        <p className="text-xs text-muted-foreground">
          Control which pages display your widget using URL path patterns.
        </p>
      </div>

      <div className="space-y-5 rounded-card border bg-card p-4 sm:p-5">
        {/* Wildcard Explanation Callout */}
        <div className="flex items-start gap-2.5 rounded-card bg-muted/40 p-3 text-xs text-muted-foreground">
          <svg className="h-4 w-4 shrink-0 text-primary mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="space-y-1 leading-relaxed">
            <p className="font-medium text-foreground">Wildcard Matching Rules</p>
            <p>
              Use <code className="rounded-control bg-muted px-1 py-0.5 font-mono text-2xs text-foreground">*</code> as a wildcard.
              Example: <code className="rounded-control bg-muted px-1 py-0.5 font-mono text-2xs text-foreground">/products/*</code> matches all product detail pages.
              Use <code className="rounded-control bg-muted px-1 py-0.5 font-mono text-2xs text-foreground">*</code> to target all pages across your website.
            </p>
          </div>
        </div>

        {/* Included Pages */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="pages-included-input"
              className="text-xs font-medium text-foreground"
            >
              Included URL Patterns
            </label>
            <span className="text-2xs text-muted-foreground">
              {pagesIncluded.length} pattern{pagesIncluded.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              id="pages-included-input"
              type="text"
              value={includeInput}
              onChange={(e) => setIncludeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddInclude();
                }
              }}
              placeholder="e.g. *, /pricing, /products/*"
              className="flex-1 rounded-control border bg-background px-3 py-1.5 font-mono text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleAddInclude}
              disabled={!includeInput.trim()}
              className="rounded-control border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              Add Pattern
            </button>
          </div>

          {pagesIncluded.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {pagesIncluded.map((pattern) => (
                <span
                  key={pattern}
                  className="inline-flex items-center gap-1.5 rounded-control border bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary"
                >
                  <span>{pattern}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInclude(pattern)}
                    className="text-primary/70 hover:text-primary transition-colors"
                    title="Remove pattern"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-2xs text-destructive">
              Warning: No included patterns set. The widget will not display on any page.
            </p>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Excluded Pages */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="pages-excluded-input"
              className="text-xs font-medium text-foreground"
            >
              Excluded URL Patterns
            </label>
            <span className="text-2xs text-muted-foreground">
              {pagesExcluded.length} pattern{pagesExcluded.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              id="pages-excluded-input"
              type="text"
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddExclude();
                }
              }}
              placeholder="e.g. /admin/*, /checkout/*, /login"
              className="flex-1 rounded-control border bg-background px-3 py-1.5 font-mono text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleAddExclude}
              disabled={!excludeInput.trim()}
              className="rounded-control border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              Add Exclusion
            </button>
          </div>

          {pagesExcluded.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {pagesExcluded.map((pattern) => (
                <span
                  key={pattern}
                  className="inline-flex items-center gap-1.5 rounded-control border bg-destructive/10 px-2.5 py-1 font-mono text-xs text-destructive"
                >
                  <span>{pattern}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExclude(pattern)}
                    className="text-destructive/70 hover:text-destructive transition-colors"
                    title="Remove exclusion"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-2xs text-muted-foreground">
              No exclusions configured. The widget is not blocked on any matched pages.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
