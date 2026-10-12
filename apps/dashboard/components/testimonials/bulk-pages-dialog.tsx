"use client";

import { useState } from "react";
import type { MatchRules } from "@/lib/validations/testimonials";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModalOverlay } from "@/components/ui/modal";
import { MatchRulesEditor } from "./match-rules-editor";

interface BulkPagesDialogProps {
  spaceId: string;
  ids: string[];
  onClose: () => void;
  onSaved: (ids: string[], rules: MatchRules) => void;
}

/** Sets the same page rules on every selected testimonial. */
export function BulkPagesDialog({ spaceId, ids, onClose, onSaved }: BulkPagesDialogProps) {
  const [rules, setRules] = useState<MatchRules>({ mode: "all", urlPatterns: [], tags: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/testimonials/match-rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, matchRules: rules }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Could not save page rules");
      onSaved(data.updated ?? ids, rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save page rules");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay label="Set pages for selected testimonials" onClose={onClose}>
      <Card variant="flat" className="my-8 w-full max-w-2xl space-y-4 p-4 shadow-float sm:p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-medium tracking-tight">Set pages for {ids.length} {ids.length === 1 ? "testimonial" : "testimonials"}</h2>
          <p className="text-xs text-text-muted">This replaces any page rules they have now.</p>
        </div>
        {error && <div className="rounded-control bg-danger-soft p-3 text-xs text-danger-foreground">{error}</div>}
        <MatchRulesEditor value={rules} onChange={setRules} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Cancel
          </button>
          <Button type="button" variant="primary" size="sm" onClick={save} loading={saving} disabled={saving}>
            {saving ? "Saving..." : "Apply to selected"}
          </Button>
        </div>
      </Card>
    </ModalOverlay>
  );
}
