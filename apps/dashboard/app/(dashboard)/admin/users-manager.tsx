"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/notify";
import { timeAgo } from "@/lib/time-ago";
import type { AdminUserRow } from "@/lib/admin/queries";

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
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [planValue, setPlanValue] = useState(NONE);
  const [admin, setAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  function open(u: AdminUserRow) {
    setEditing(u);
    setPlanValue(u.planId ?? NONE);
    setAdmin(u.isPlatformAdmin);
  }

  async function save() {
    if (!editing) return;
    const body: { planId?: string | null; isPlatformAdmin?: boolean } = {};
    if (!editing.billedByProvider && planValue !== (editing.planId ?? NONE)) body.planId = planValue === NONE ? null : planValue;
    if (admin !== editing.isPlatformAdmin) body.isPlatformAdmin = admin;
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
            <TableHead>Plan</TableHead>
            <TableHead>Spaces</TableHead>
            <TableHead>Joined</TableHead>
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
                </div>
                <div className="text-xs text-text-muted">{u.email}</div>
              </TableCell>
              <TableCell>
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
              <TableCell className="tabular-nums">{u.spaceCount}</TableCell>
              <TableCell className="text-text-muted">{timeAgo(u.createdAt)}</TableCell>
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
