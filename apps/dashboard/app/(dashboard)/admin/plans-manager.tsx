"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/notify";
import type { AdminPlan } from "@/lib/admin/plans";

interface FormState {
  name: string;
  description: string;
  badge: string;
  price: string; // dollars, as typed
  interval: "month" | "year";
  sortOrder: string;
  features: string; // one per line
  maxSpaces: string;
  maxSpacesUnlimited: boolean;
  maxTestimonials: string;
  maxTestimonialsUnlimited: boolean;
  flags: Record<(typeof FLAGS)[number]["key"], boolean>;
  stripeProductId: string;
  stripePriceId: string;
  dodoProductId: string;
  dodoPriceId: string;
  isActive: boolean;
}

const FLAGS = [
  { key: "removeWatermark", label: "Remove Vouchreel watermark" },
  { key: "canCustomizeBranding", label: "Custom branding" },
  { key: "canUseAllTriggers", label: "All widget triggers" },
  { key: "canAccessAnalytics", label: "Analytics access" },
  { key: "canUseCustomRules", label: "Custom CSS and advanced match rules" },
  { key: "multiSeat", label: "Multi-seat team accounts" },
  { key: "whiteLabel", label: "White-label branding" },
  { key: "exportableReports", label: "Exportable reports" },
] as const;

const dollars = (cents: number) => (cents / 100).toFixed(2);

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    badge: "",
    price: "0.00",
    interval: "month",
    sortOrder: "50",
    features: "",
    maxSpaces: "1",
    maxSpacesUnlimited: false,
    maxTestimonials: "3",
    maxTestimonialsUnlimited: false,
    flags: Object.fromEntries(FLAGS.map((f) => [f.key, false])) as FormState["flags"],
    stripeProductId: "",
    stripePriceId: "",
    dodoProductId: "",
    dodoPriceId: "",
    isActive: true,
  };
}

function formFromPlan(plan: AdminPlan): FormState {
  const limit = (key: string) => Number(plan.limits[key] ?? 0);
  return {
    name: plan.name,
    description: plan.description ?? "",
    badge: plan.badge ?? "",
    price: dollars(plan.price),
    interval: plan.interval,
    sortOrder: String(plan.sortOrder),
    features: plan.features.join("\n"),
    maxSpaces: limit("maxSpaces") < 0 ? "1" : String(limit("maxSpaces")),
    maxSpacesUnlimited: limit("maxSpaces") < 0,
    maxTestimonials: limit("maxTestimonialsPerSpace") < 0 ? "3" : String(limit("maxTestimonialsPerSpace")),
    maxTestimonialsUnlimited: limit("maxTestimonialsPerSpace") < 0,
    flags: Object.fromEntries(FLAGS.map((f) => [f.key, Boolean(plan.limits[f.key])])) as FormState["flags"],
    stripeProductId: plan.stripeProductId ?? "",
    stripePriceId: plan.stripePriceId ?? "",
    dodoProductId: plan.dodoProductId ?? "",
    dodoPriceId: plan.dodoPriceId ?? "",
    isActive: plan.isActive,
  };
}

function payloadFromForm(f: FormState, tier: string) {
  const cents = Math.round(Number(f.price) * 100);
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    badge: f.badge.trim() || null,
    price: cents,
    interval: f.interval,
    sortOrder: Number(f.sortOrder) || 0,
    features: f.features.split("\n").map((l) => l.trim()).filter(Boolean),
    limits: {
      tier,
      maxSpaces: f.maxSpacesUnlimited ? -1 : Number(f.maxSpaces),
      maxTestimonialsPerSpace: f.maxTestimonialsUnlimited ? -1 : Number(f.maxTestimonials),
      ...f.flags,
    },
    stripeProductId: f.stripeProductId.trim() || null,
    stripePriceId: f.stripePriceId.trim() || null,
    dodoProductId: f.dodoProductId.trim() || null,
    dodoPriceId: f.dodoPriceId.trim() || null,
    isActive: f.isActive,
  };
}

function limitLabel(value: unknown) {
  return typeof value === "number" && value < 0 ? "Unlimited" : String(value);
}

export function PlansManager({ plans }: { plans: AdminPlan[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AdminPlan | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  function openNew() {
    setForm(emptyForm());
    setEditing("new");
  }

  function openEdit(plan: AdminPlan) {
    setForm(formFromPlan(plan));
    setEditing(plan);
  }

  const patch = (changes: Partial<FormState>) => setForm((prev) => ({ ...prev, ...changes }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const isNew = editing === "new";
    const tier = isNew ? "custom" : String(editing.limits.tier ?? "custom");
    setSaving(true);
    try {
      const res = await fetch(isNew ? "/api/admin/plans" : `/api/admin/plans/${editing.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm(form, tier)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fieldErrors = data?.error?.details as Record<string, string[]> | undefined;
        const first = fieldErrors && Object.entries(fieldErrors)[0];
        throw new Error(first ? `${first[0]}: ${first[1]?.[0]}` : data?.error?.message || "Could not save plan");
      }
      notify.success(isNew ? "Plan created" : "Plan updated", {
        description: isNew ? undefined : "New limits apply to subscribers immediately.",
      });
      setEditing(null);
      router.refresh();
    } catch (err) {
      notify.fromError(err, "Could not save plan");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan: AdminPlan) {
    if (plan.isActive) {
      const ok = await confirm({
        title: `Archive ${plan.name} (${plan.interval}ly)?`,
        description: `It disappears from pricing and checkout. ${plan.subscriberCount} current subscriber${plan.subscriberCount === 1 ? "" : "s"} keep their access.`,
        confirmLabel: "Archive plan",
        tone: "danger",
      });
      if (!ok) return;
    }
    try {
      const res = plan.isActive
        ? await fetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" })
        : await fetch(`/api/admin/plans/${plan.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: true }),
          });
      if (!res.ok) throw new Error("Could not update the plan");
      notify.success(plan.isActive ? "Plan archived" : "Plan activated");
      router.refresh();
    } catch (err) {
      notify.fromError(err, "Could not update the plan");
    }
  }

  const editingPlan = editing && editing !== "new" ? editing : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-text-muted">
          Prices, limits and feature flags are read live from the database. Changing a plan&apos;s limits updates
          everyone on it immediately.
        </p>
        <Button onClick={openNew}>
          <Icon name="add-circle" size="sm" /> New plan
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Price</TableHead>
            <TableHead className="hidden md:table-cell">Spaces</TableHead>
            <TableHead className="hidden md:table-cell">Testimonials</TableHead>
            <TableHead className="hidden md:table-cell">Subscribers</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell>
                <div className="font-medium">{plan.name}</div>
                {plan.badge && <Badge variant="brand">{plan.badge}</Badge>}
                <div className="mt-1 text-xs text-text-muted md:hidden">
                  {plan.isActive ? "Active" : "Archived"} · {plan.subscriberCount} subscribers
                </div>
              </TableCell>
              <TableCell className="tabular-nums">
                ${dollars(plan.price)}
                <span className="text-xs text-text-muted"> / {plan.interval}</span>
              </TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">{limitLabel(plan.limits.maxSpaces)}</TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">{limitLabel(plan.limits.maxTestimonialsPerSpace)}</TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">{plan.subscriberCount}</TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant={plan.isActive ? "success" : "neutral"}>{plan.isActive ? "Active" : "Archived"}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                    Edit
                  </Button>
                  <Button size="sm" variant={plan.isActive ? "ghost-danger" : "soft"} onClick={() => toggleActive(plan)}>
                    {plan.isActive ? "Archive" : "Activate"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {plans.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-text-muted">
                No plans yet. Create the first one.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlan ? `Edit ${editingPlan.name}` : "New plan"}</DialogTitle>
            <DialogDescription>
              {editingPlan && editingPlan.subscriberCount > 0
                ? `${editingPlan.subscriberCount} subscribers are on this plan. Limit changes apply to them now; existing subscriptions keep billing at the provider price they signed up for.`
                : "Set the price, limits and the copy shown on the pricing page."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="plan-name">
                <Input id="plan-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} required />
              </Field>
              <Field label="Badge" htmlFor="plan-badge" hint='e.g. "Most popular"'>
                <Input id="plan-badge" value={form.badge} onChange={(e) => patch({ badge: e.target.value })} maxLength={30} />
              </Field>
              <Field label="Description" htmlFor="plan-desc" className="sm:col-span-2">
                <Input id="plan-desc" value={form.description} onChange={(e) => patch({ description: e.target.value })} maxLength={200} />
              </Field>
              <Field label="Price (USD)" htmlFor="plan-price">
                <Input id="plan-price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => patch({ price: e.target.value })} required />
              </Field>
              <Field label="Billing interval" htmlFor="plan-interval">
                <Select value={form.interval} onValueChange={(v) => patch({ interval: v as "month" | "year" })}>
                  <SelectTrigger id="plan-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sort order" htmlFor="plan-order" hint="Lower numbers appear first">
                <Input id="plan-order" type="number" min="0" value={form.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} />
              </Field>
              <Field label="Active" htmlFor="plan-active" hint="Inactive plans are hidden from pricing and checkout">
                <Switch id="plan-active" checked={form.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
              </Field>
            </div>

            <Field label="Feature bullets" htmlFor="plan-features" hint="One per line, shown on the pricing card">
              <Textarea id="plan-features" rows={5} value={form.features} onChange={(e) => patch({ features: e.target.value })} />
            </Field>

            <fieldset className="space-y-4 rounded-card border p-4">
              <legend className="px-2 text-sm font-medium">Limits and entitlements</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Max spaces" htmlFor="plan-spaces">
                  <div className="flex items-center gap-3">
                    <Input id="plan-spaces" type="number" min="0" disabled={form.maxSpacesUnlimited} value={form.maxSpaces} onChange={(e) => patch({ maxSpaces: e.target.value })} />
                    <label className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
                      <Switch checked={form.maxSpacesUnlimited} onCheckedChange={(v) => patch({ maxSpacesUnlimited: v })} aria-label="Unlimited spaces" />
                      Unlimited
                    </label>
                  </div>
                </Field>
                <Field label="Max testimonials per space" htmlFor="plan-testimonials">
                  <div className="flex items-center gap-3">
                    <Input id="plan-testimonials" type="number" min="0" disabled={form.maxTestimonialsUnlimited} value={form.maxTestimonials} onChange={(e) => patch({ maxTestimonials: e.target.value })} />
                    <label className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
                      <Switch checked={form.maxTestimonialsUnlimited} onCheckedChange={(v) => patch({ maxTestimonialsUnlimited: v })} aria-label="Unlimited testimonials" />
                      Unlimited
                    </label>
                  </div>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {FLAGS.map((flag) => (
                  <label key={flag.key} className="flex items-center justify-between gap-3 rounded-control bg-surface-sunken px-3 py-2.5 text-sm">
                    {flag.label}
                    <Switch
                      checked={form.flags[flag.key]}
                      onCheckedChange={(v) => patch({ flags: { ...form.flags, [flag.key]: v } })}
                      aria-label={flag.label}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-card border p-4">
              <legend className="px-2 text-sm font-medium">Payment provider IDs</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Stripe product ID" htmlFor="plan-sp">
                  <Input id="plan-sp" value={form.stripeProductId} onChange={(e) => patch({ stripeProductId: e.target.value })} />
                </Field>
                <Field label="Stripe price ID" htmlFor="plan-spr">
                  <Input id="plan-spr" value={form.stripePriceId} onChange={(e) => patch({ stripePriceId: e.target.value })} />
                </Field>
                <Field label="Dodo product ID" htmlFor="plan-dp">
                  <Input id="plan-dp" value={form.dodoProductId} onChange={(e) => patch({ dodoProductId: e.target.value })} />
                </Field>
                <Field label="Dodo price ID" htmlFor="plan-dpr">
                  <Input id="plan-dpr" value={form.dodoPriceId} onChange={(e) => patch({ dodoPriceId: e.target.value })} />
                </Field>
              </div>
              <p className="text-xs text-text-muted">
                Checkout charges the price configured at the provider for these IDs. Create the matching price there first,
                then paste its ID.
              </p>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editingPlan ? "Save changes" : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
