"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/lib/notify";
import type { PreferenceRow } from "@/lib/notifications/queries";

type Channel = "inApp" | "email";

export function PreferencesForm({ initial }: { initial: PreferenceRow[] }) {
  const [rows, setRows] = useState(initial);

  async function toggle(type: PreferenceRow["type"], channel: Channel, value: boolean) {
    const previous = rows;
    setRows((prev) => prev.map((r) => (r.type === type ? { ...r, [channel]: value } : r)));
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, [channel]: value }),
      });
      if (!res.ok) throw new Error("Could not save your preference");
    } catch (err) {
      setRows(previous);
      notify.fromError(err, "Could not save your preference");
    }
  }

  return (
    <Card>
      <div className="hidden grid-cols-[1fr_5rem_5rem] items-center gap-4 border-b px-6 py-3 text-xs text-text-muted sm:grid">
        <span>Event</span>
        <span className="text-center">In app</span>
        <span className="text-center">Email</span>
      </div>
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.type} className="grid grid-cols-2 items-center gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-[1fr_5rem_5rem] sm:px-6">
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-text-muted">{row.description}</p>
            </div>
            <label className="flex items-center justify-between gap-2 text-xs text-text-muted sm:justify-center">
              <span className="sm:sr-only">In app</span>
              <Switch
                checked={row.inApp}
                onCheckedChange={(v) => toggle(row.type, "inApp", v)}
                aria-label={`${row.label}: in app`}
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-text-muted sm:justify-center">
              <span className="sm:sr-only">Email</span>
              <Switch
                checked={row.email}
                onCheckedChange={(v) => toggle(row.type, "email", v)}
                aria-label={`${row.label}: email`}
              />
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
