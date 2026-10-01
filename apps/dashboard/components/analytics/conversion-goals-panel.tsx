"use client";

import { useState } from "react";

export interface ConversionGoal {
  id: string;
  goalType: string;
  goalValue: string;
  createdAt: string;
}

interface ConversionGoalsPanelProps {
  spaceId: string;
  goals: ConversionGoal[];
  onGoalsChanged: (goals: ConversionGoal[]) => void;
}

function pixelSnippet(goalId: string): string {
  return `<script>window.vouchreelConvert && window.vouchreelConvert('${goalId}');</script>`;
}

export function ConversionGoalsPanel({
  spaceId,
  goals,
  onGoalsChanged,
}: ConversionGoalsPanelProps) {
  const [goalType, setGoalType] = useState<"url-match" | "pixel">("url-match");
  const [goalValue, setGoalValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedGoalId, setCopiedGoalId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/conversion-goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalType, goalValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.error?.details?.goalValue?.[0];
        throw new Error(detail || data?.error?.message || "Failed to create goal");
      }
      onGoalsChanged([...goals, data.goal]);
      setGoalValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(goalId: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/spaces/${spaceId}/conversion-goals?goalId=${encodeURIComponent(goalId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw new Error("Failed to delete goal");
      }
      onGoalsChanged(goals.filter((g) => g.id !== goalId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete goal");
    }
  }

  async function handleCopy(goal: ConversionGoal) {
    const snippet = pixelSnippet(goal.id);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedGoalId(goal.id);
      setTimeout(() => setCopiedGoalId(null), 2000);
    } catch {
      setError("Could not copy snippet to clipboard");
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Conversion Goals</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Track whether visitors who see your testimonials end up converting.
      </p>

      {error && (
        <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="mt-4 space-y-3">
        <div className="flex gap-1 rounded-md border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setGoalType("url-match")}
            className={`rounded px-3 py-1.5 font-medium ${
              goalType === "url-match"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            URL match
          </button>
          <button
            type="button"
            onClick={() => setGoalType("pixel")}
            className={`rounded px-3 py-1.5 font-medium ${
              goalType === "pixel"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Conversion pixel
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={goalValue}
            onChange={(e) => setGoalValue(e.target.value)}
            placeholder={
              goalType === "url-match"
                ? "/thank-you or /order-confirmation/*"
                : "Goal name, e.g. Purchase complete"
            }
            className="flex-1 rounded-md border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Goal"}
          </button>
        </div>
        {goalType === "url-match" && (
          <p className="text-[10px] text-muted-foreground">
            The widget fires a conversion whenever a visitor lands on a matching URL.
            Use * as a wildcard (e.g. /checkout/*).
          </p>
        )}
      </form>

      {/* Goal list */}
      <div className="mt-4 space-y-2">
        {goals.length === 0 ? (
          <p className="rounded-md bg-muted/40 p-4 text-center text-xs text-muted-foreground">
            No conversion goals yet. Create one above to start measuring ROI.
          </p>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                    {goal.goalType}
                  </span>
                  <p className="truncate text-xs font-medium">{goal.goalValue}</p>
                </div>
                {goal.goalType === "pixel" && (
                  <code className="mt-1 block truncate rounded bg-muted/60 px-2 py-1 text-[10px] text-muted-foreground">
                    {pixelSnippet(goal.id)}
                  </code>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {goal.goalType === "pixel" && (
                  <button
                    onClick={() => handleCopy(goal)}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                  >
                    {copiedGoalId === goal.id ? "Copied!" : "Copy snippet"}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
