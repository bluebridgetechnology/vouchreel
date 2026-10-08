"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function AuthorRemovalCard() {
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState<{ submissions: number; testimonials: number } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(confirmRemoval: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/author-removal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, confirm: confirmRemoval }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.details?.email?.[0] || data?.error?.message || "Something went wrong");
      if (confirmRemoval) {
        setDone(`Removed ${data.removed.submissions} submission(s) and ${data.removed.testimonials} testimonial(s) for ${email}, with their videos.`);
        setPreview(null);
        setEmail("");
      } else {
        setPreview(data.preview);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card variant="flat" className="space-y-3 p-4 sm:p-6 md:col-span-2">
      <h2 className="text-base font-medium">Remove a customer&apos;s data</h2>
      <p className="text-sm text-text-muted">
        When someone who gave you a testimonial asks to be forgotten, enter the email they used on your collection form. We find their submissions and the testimonials and videos made from them, and delete them. Testimonials you typed in by hand have no email and must be deleted from the Testimonials page.
      </p>
      {error && (
        <div role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger-foreground">
          {error}
        </div>
      )}
      {done && <p role="status" className="text-sm text-text">{done}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setDone(null);
          void call(false);
        }}
        className="flex max-w-lg flex-wrap items-end gap-3"
      >
        <Field label="Customer's email" htmlFor="author-email" className="min-w-0 flex-1">
          <Input id="author-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setPreview(null); }} required />
        </Field>
        <Button type="submit" variant="outline" size="md" loading={busy && !preview}>
          Find
        </Button>
      </form>
      {preview && (
        <div className="space-y-2 text-sm">
          <p>
            Found <strong>{preview.submissions}</strong> submission(s) and <strong>{preview.testimonials}</strong> testimonial(s).
          </p>
          {preview.submissions > 0 ? (
            <Button variant="danger" size="sm" loading={busy} onClick={() => void call(true)}>
              Delete them permanently
            </Button>
          ) : (
            <p className="text-text-muted">Nothing to remove for that email.</p>
          )}
        </div>
      )}
    </Card>
  );
}
