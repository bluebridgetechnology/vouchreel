"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm";
import { timeAgo } from "@/lib/time-ago";
import type { AdminUserRow } from "@/lib/admin/queries";
import type { AdjustmentRow } from "@/lib/admin/credit-adjustments";

export interface PlanOption {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  isActive: boolean;
}

const NONE = "none";

const money = (cents: number, interval: string) => (cents === 0 ? "free" : `$${(cents / 100).toFixed(2)}/${interval === "year" ? "yr" : "mo"}`);

interface Props {
  users: AdminUserRow[];
  plans: PlanOption[];
  currentUserId: string;
  q?: string;
  page: number;
  pageSize: number;
  total: number;
}

export function UsersManager({ users, plans, currentUserId, q, page, pageSize, total }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [planValue, setPlanValue] = useState(NONE);
  const [admin, setAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [creditKind, setCreditKind] = useState<"review" | "ai">("review");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [crediting, setCrediting] = useState(false);

  function open(u: AdminUserRow) {
    setEditing(u);
    setPlanValue(u.planId ?? NONE);
    setAdmin(u.isPlatformAdmin);
    setSuspended(!!u.suspendedAt);
    setSuspendReason(u.suspendedReason ?? "");
    setCreditAmount("");
    setCreditReason("");
    setAdjustments([]);
  }

  async function loadAdjustments(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}/credits`);
    if (!res.ok) return;
    const data = (await res.json()) as { adjustments: (Omit<AdjustmentRow, "createdAt"> & { createdAt: string })[] };
    setAdjustments(data.adjustments.map((a) => ({ ...a, createdAt: new Date(a.createdAt) })));
  }

  useEffect(() => {
    if (editing) void loadAdjustments(editing.id);
  }, [editing]);

  async function applyCredits() {
    if (!editing) return;
    const amount = Number(creditAmount);
    setCrediting(true);
    try {
      const res = await fetch(`/api/admin/users/${editing.id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: creditKind, amount, reason: creditReason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not adjust credits");
      notify.success("Credits adjusted for this month.");
      setCreditAmount("");
      setCreditReason("");
      await loadAdjustments(editing.id);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Could not adjust credits");
    } finally {
      setCrediting(false);
    }
  }

  async function resetTwoFactor() {
    if (!editing) return;
    if (!(await confirm({ title: "Reset two-factor sign-in?", description: `${editing.email} will be able to sign in with just their password until they set it up again. Do this only for someone who has lost their phone and backup codes.`, confirmLabel: "Reset", tone: "danger" }))) return;
    const res = await fetch(`/api/admin/users/${editing.id}/two-factor`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      notify.error(data?.error?.message || "Could not reset two-factor sign-in");
      return;
    }
    notify.success("Two-factor sign-in reset.");
    setEditing(null);
    router.refresh();
  }

  async function save() {
    if (!editing) return;
    const body: { planId?: string | null; isPlatformAdmin?: boolean; suspended?: boolean; suspendedReason?: string } = {};
    if (!editing.billedByProvider && planValue !== (editing.planId ?? NONE)) body.planId = planValue === NONE ? null : planValue;
    if (admin !== editing.isPlatformAdmin) body.isPlatformAdmin = admin;
    if (suspended !== !!editing.suspendedAt) {
      body.suspended = suspended;
      if (suspended) body.suspendedReason = suspendReason;
    }
    if (Object.keys(body).length === 0) {
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not update the user");
      notify.success(`Updated ${editing.email}.`);
      setEditing(null);
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Could not update the user");
    } finally {
      setSaving(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => `/admin?tab=users&page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const isSelf = editing?.id === currentUserId;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead className="hidden sm:table-cell">Plan</TableHead>
            <TableHead className="hidden sm:table-cell">Spaces</TableHead>
            <TableHead className="hidden sm:table-cell">Joined</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex items-center gap-2 font-medium">
                  {u.name}
                  {u.isPlatformAdmin && <Badge variant="brand">Admin</Badge>}
                  {u.suspendedAt && <Badge variant="danger">Suspended</Badge>}
                </div>
                <div className="max-w-[11rem] truncate text-xs text-text-muted sm:max-w-none" title={u.email}>{u.email}</div>
                <div className="text-xs text-text-muted sm:hidden">{u.planName ?? "Free"}{u.subscriptionProvider === "manual" ? " (granted)" : ""} · {u.spaceCount} spaces · joined {timeAgo(u.createdAt)}</div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {u.planName ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {u.planName}
                    {u.subscriptionProvider === "manual" && <Badge variant="info">Granted</Badge>}
                    {u.subscriptionStatus && u.subscriptionStatus !== "active" && <Badge variant="warning">{u.subscriptionStatus}</Badge>}
                  </span>
                ) : (
                  <span className="text-text-muted">Free</span>
                )}
              </TableCell>
              <TableCell className="hidden tabular-nums sm:table-cell">{u.spaceCount}</TableCell>
              <TableCell className="hidden text-text-muted sm:table-cell">{timeAgo(u.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => open(u)}>
                  Manage
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-text-muted">
                No users match.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-subtle">
        <span>
          {total === 0 ? "0 users" : `${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total} users`}
        </span>
        <nav aria-label="Users pages" className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} className="rounded-control border px-3 py-1.5 text-text hover:bg-surface-sunken">
              Previous
            </Link>
          ) : null}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href(page + 1)} className="rounded-control border px-3 py-1.5 text-text hover:bg-surface-sunken">
              Next
            </Link>
          ) : null}
        </nav>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <Field
                label="Plan"
                htmlFor="user-plan"
                hint={
                  editing.billedByProvider
                    ? `Billed by ${editing.subscriptionProvider ?? "the payment provider"}. Change or cancel it there, otherwise they keep paying the old price.`
                    : "Granting a plan here gives the customer its limits without billing them. Choose Free to remove a granted plan."
                }
              >
                <Select value={planValue} onValueChange={setPlanValue} disabled={editing.billedByProvider}>
                  <SelectTrigger id="user-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Free (no plan)</SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({money(p.price, p.interval)}){p.isActive ? "" : " - archived"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Platform admin"
                htmlFor="user-admin"
                hint={isSelf ? "You cannot change your own admin access." : "Can open this Admin area, edit plans and change other customers."}
              >
                <Switch id="user-admin" checked={admin} onCheckedChange={setAdmin} disabled={isSelf} />
              </Field>
              <Field
                label="Suspended"
                htmlFor="user-suspended"
                hint={
                  isSelf
                    ? "You cannot suspend your own account."
                    : editing.isPlatformAdmin
                      ? "Remove this person's admin access first."
                      : "They cannot sign in and any open session stops working. Their data and public widgets are left as they are."
                }
              >
                <Switch id="user-suspended" checked={suspended} onCheckedChange={setSuspended} disabled={isSelf || editing.isPlatformAdmin} />
              </Field>
              {suspended && (
                <Field label="Reason" htmlFor="user-suspend-reason" hint="Shown to them when they try to sign in.">
                  <Input id="user-suspend-reason" value={suspendReason} maxLength={300} onChange={(e) => setSuspendReason(e.target.value)} />
                </Field>
              )}
              <Field
                label="Two-factor sign-in"
                htmlFor="user-two-factor"
                hint={isSelf ? "Ask another admin to reset yours." : "For someone locked out. It is recorded in the audit log."}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{editing.twoFactorEnabled ? "On" : "Off"}</span>
                  {editing.twoFactorEnabled && !isSelf && (
                    <Button id="user-two-factor" type="button" variant="outline-danger" size="sm" onClick={resetTwoFactor}>
                      Reset two-factor
                    </Button>
                  )}
                </div>
              </Field>
              <fieldset className="space-y-3 rounded-card border p-4">
                <legend className="px-2 text-sm font-medium">Video credits this month</legend>
                <p className="text-xs text-text-muted">Adds to (or, with a minus, takes from) the plan's allowance for this calendar month only.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Credits for" htmlFor="credit-kind">
                    <Select value={creditKind} onValueChange={(v) => setCreditKind(v as "review" | "ai")}>
                      <SelectTrigger id="credit-kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="review">Review videos</SelectItem>
                        <SelectItem value="ai">AI videos</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Amount" htmlFor="credit-amount" hint="Whole number, e.g. 5 or -2">
                    <Input id="credit-amount" type="number" step="1" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
                  </Field>
                </div>
                <Field label="Reason" htmlFor="credit-reason">
                  <Input id="credit-reason" value={creditReason} maxLength={300} onChange={(e) => setCreditReason(e.target.value)} />
                </Field>
                <Button type="button" variant="outline" size="sm" onClick={applyCredits} loading={crediting} disabled={!creditAmount || !creditReason.trim()}>
                  Apply credits
                </Button>
                {adjustments.length > 0 && (
                  <ul className="space-y-1 text-xs text-text-muted" aria-label="Adjustments this month">
                    {adjustments.map((a) => (
                      <li key={a.id}>
                        <span className="font-medium text-text">
                          {a.amount > 0 ? "+" : ""}
                          {a.amount} {a.kind === "ai" ? "AI" : "review"}
                        </span>{" "}
                        {a.reason} ({a.actorEmail ?? "unknown"}, {timeAgo(a.createdAt)})
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
