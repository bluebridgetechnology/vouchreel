"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";

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
    <div className="rounded-card border bg-card p-4">
      <h3 className="text-sm font-medium">Conversion Goals</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Track whether visitors who see your testimonials end up converting.
      </p>

      {error && (
        <div className="mt-3 rounded-control bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="mt-4 space-y-3">
        <div className="flex gap-1 rounded-control border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setGoalType("url-match")}
            className={cn("rounded-control px-3 py-1.5 font-medium", toggleStyle("solid", goalType === "url-match"))}
          >
            URL match
          </button>
          <button
            type="button"
            onClick={() => setGoalType("pixel")}
            className={cn("rounded-control px-3 py-1.5 font-medium", toggleStyle("solid", goalType === "pixel"))}
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
            className={cn(inputClass, "flex-1 text-xs")}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className={buttonVariants({ variant: "primary", size: "sm" })}
          >
            {submitting ? "Creating..." : "Create Goal"}
          </button>
        </div>
        {goalType === "url-match" && (
          <p className="text-2xs text-muted-foreground">
            The widget fires a conversion whenever a visitor lands on a matching URL.
            Use * as a wildcard (e.g. /checkout/*).
          </p>
        )}
      </form>

      {/* Goal list */}
      <div className="mt-4 space-y-2">
        {goals.length === 0 ? (
          <p className="rounded-control bg-muted/40 p-4 text-center text-xs text-muted-foreground">
            No conversion goals yet. Create one above to start measuring ROI.
          </p>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="flex flex-col gap-2 rounded-card border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-control bg-muted px-1.5 py-0.5 text-2xs font-medium uppercase text-muted-foreground">
                    {goal.goalType}
                  </span>
                  <p className="truncate text-xs font-medium">{goal.goalValue}</p>
                </div>
                {goal.goalType === "pixel" && (
                  <code className="mt-1 block truncate rounded-control bg-muted/60 px-2 py-1 text-2xs text-muted-foreground">
                    {pixelSnippet(goal.id)}
                  </code>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {goal.goalType === "pixel" && (
                  <button
                    onClick={() => handleCopy(goal)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {copiedGoalId === goal.id ? "Copied!" : "Copy snippet"}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(goal.id)}
                  className={buttonVariants({ variant: "outline-danger", size: "sm" })}
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
