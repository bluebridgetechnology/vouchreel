"use client";

import { useState } from "react";
import type { MatchRules } from "@/lib/validations/testimonials";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModalOverlay } from "@/components/ui/modal";
import { MatchRulesEditor } from "@/components/testimonials/match-rules-editor";

interface ReviewPagesDialogProps {
  spaceId: string;
  reviewId: string;
  authorName: string;
  initial: MatchRules | null;
  onClose: () => void;
  onSaved: (rules: MatchRules) => void;
}

/** Chooses the pages a single review shows on. */
export function ReviewPagesDialog({ spaceId, reviewId, authorName, initial, onClose, onSaved }: ReviewPagesDialogProps) {
  const [rules, setRules] = useState<MatchRules>(initial ?? { mode: "all", urlPatterns: [], tags: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchRules: rules }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Could not save page rules");
      onSaved(rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save page rules");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay label="Choose pages for this review" onClose={onClose}>
      <Card variant="flat" className="my-8 w-full max-w-2xl space-y-4 p-4 shadow-float sm:p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-medium tracking-tight">Pages for {authorName}&apos;s review</h2>
          <p className="text-xs text-text-muted">Choose where on your site this review appears.</p>
        </div>
        {error && <div className="rounded-control bg-danger-soft p-3 text-xs text-danger-foreground">{error}</div>}
        <MatchRulesEditor value={rules} onChange={setRules} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Cancel
          </button>
          <Button type="button" variant="primary" size="sm" onClick={save} loading={saving} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </Card>
    </ModalOverlay>
  );
}
