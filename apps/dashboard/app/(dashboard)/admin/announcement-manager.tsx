"use client";

import { useState } from "react";
import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/lib/notify";
import {
  ANNOUNCEMENT_LINK_TEXT_DEFAULT,
  ANNOUNCEMENT_LINK_TEXT_MAX,
  ANNOUNCEMENT_MESSAGE_MAX,
  announcementSchema,
  type Announcement,
} from "@/lib/validations/announcement";

type Errors = Partial<Record<keyof Announcement, string>>;

/** Admin > Announcement: the bar shown across the top of the marketing pages, with a live preview of what visitors will see. */
export function AnnouncementManager({ initial }: { initial: Announcement }) {
  const [form, setForm] = useState<Announcement>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const patch = (next: Partial<Announcement>) => setForm((f) => ({ ...f, ...next }));

  async function save() {
    // The same rules the server applies, so a mistake is shown beside its field before anything is sent
    const checked = announcementSchema.safeParse(form);
    if (!checked.success) {
      const fieldErrors = checked.error.flatten().fieldErrors;
      setErrors({
        message: fieldErrors.message?.[0],
        linkText: fieldErrors.linkText?.[0],
        linkUrl: fieldErrors.linkUrl?.[0],
      });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to save the announcement");
      notify.success(checked.data.enabled ? "Announcement saved. It shows on the marketing pages now." : "Announcement saved and switched off.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error saving the announcement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card variant="flat" className="space-y-6 p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-xl font-medium">Announcement bar</h2>
          <p className="mt-1 text-sm text-text-muted">
            One line across the top of the homepage, pricing and other marketing pages, with an optional link. Visitors can close it, and it
            comes back whenever you change what it says.
          </p>
        </div>

        <Field label="Show the announcement" htmlFor="announcement-enabled" hint="Off keeps your text saved without showing it">
          <Switch id="announcement-enabled" checked={form.enabled} onCheckedChange={(enabled) => patch({ enabled })} />
        </Field>

        <Field
          label="Message"
          htmlFor="announcement-message"
          error={errors.message}
          hint={`${form.message.length} of ${ANNOUNCEMENT_MESSAGE_MAX} characters`}
        >
          <Input
            id="announcement-message"
            value={form.message}
            maxLength={ANNOUNCEMENT_MESSAGE_MAX}
            placeholder="We're now in beta: join the first teams on Vouchreel"
            onChange={(e) => patch({ message: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link text" htmlFor="announcement-link-text" error={errors.linkText} hint={`Shown as "${ANNOUNCEMENT_LINK_TEXT_DEFAULT}" when left blank`}>
            <Input
              id="announcement-link-text"
              value={form.linkText}
              maxLength={ANNOUNCEMENT_LINK_TEXT_MAX}
              placeholder="Join the beta"
              onChange={(e) => patch({ linkText: e.target.value })}
            />
          </Field>
          <Field
            label="Link address"
            htmlFor="announcement-link-url"
            error={errors.linkUrl}
            hint="A page on this site such as /pricing, or a full https:// address. Leave blank for no link"
          >
            <Input id="announcement-link-url" value={form.linkUrl} placeholder="/signup" onChange={(e) => patch({ linkUrl: e.target.value })} />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Preview</p>
          <div className="overflow-hidden rounded-card border">
            {form.message ? (
              <AnnouncementBar preview id="preview" message={form.message} linkText={form.linkText} linkUrl={form.linkUrl} />
            ) : (
              <p className="bg-surface-sunken px-4 py-3 text-sm text-text-muted">Write a message to see how the bar will look.</p>
            )}
          </div>
          {!form.enabled && form.message && <p className="text-xs text-text-muted">This is switched off, so visitors do not see it yet.</p>}
        </div>

        <div className="flex justify-end">
          <Button type="button" size="lg" loading={saving} disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save announcement"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
