"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WidgetTemplate } from "@/lib/validations/widget-config";
import { layoutInfo } from "@/lib/widget-editor/layouts";
import { limitHint, numbersLine, quotaLabel, widgetStatus, type WidgetNumbers, type WidgetQuotaView } from "@/lib/widget-editor/list";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { UpgradePromptModal } from "@/components/billing/upgrade-prompt-modal";
import { CopyStyleDialog } from "./copy-style-dialog";
import { EmbedSnippet } from "./embed-snippet";
import { InstallCheck } from "./install-check";
import { LayoutSketch } from "./editor/sections";

export interface WidgetListItem {
  id: string;
  name: string;
  template: WidgetTemplate;
  isLive: boolean;
  sortOrder: number;
  hasDraft: boolean;
  publishedAt: string | null;
  createdAt: string;
}

interface WidgetsViewProps {
  spaceId: string;
  embedKey: string;
  widgets: WidgetListItem[];
  quota: WidgetQuotaView;
  /** Last 30 days per widget id, from the events that name their widget. */
  stats?: Record<string, WidgetNumbers>;
}

/** The error message the API sent, else a fallback. */
async function apiMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error?.details?.name?.[0] || data?.error?.message || fallback;
}

export function WidgetsView({ spaceId, embedKey, widgets: initial, quota: initialQuota, stats = {} }: WidgetsViewProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [widgets, setWidgets] = useState(initial);
  const [quota, setQuota] = useState(initialQuota);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [renaming, setRenaming] = useState<WidgetListItem | null>(null);
  const [newName, setNewName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [copying, setCopying] = useState<WidgetListItem | null>(null);

  // The page is rendered on the server; take its numbers again after router.refresh()
  useEffect(() => {
    setWidgets(initial);
    setQuota(initialQuota);
  }, [initial, initialQuota]);

  const base = `/api/spaces/${spaceId}/widgets`;
  const editorHref = (id: string) => `/spaces/${spaceId}/widget/${id}`;
  const hint = limitHint(quota);

  /** Creates a widget (new, or a copy) and opens it in the editor. Opens the upgrade prompt at the plan's limit. */
  async function create(duplicateOf?: string) {
    if (!quota.allowed) {
      setUpgrade(true);
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(duplicateOf ? { duplicateOf } : {}) });
      if (res.status === 403) {
        setUpgrade(true);
        return;
      }
      if (!res.ok) throw new Error(await apiMessage(res, "Could not add the widget"));
      const { widget } = await res.json();
      router.push(editorHref(widget.id));
    } catch (err) {
      notify.fromError(err, "Could not add the widget");
    } finally {
      setAdding(false);
    }
  }

  async function setLive(w: WidgetListItem, isLive: boolean) {
    setBusy(w.id);
    const before = widgets;
    setWidgets((list) => list.map((x) => (x.id === w.id ? { ...x, isLive, publishedAt: isLive && !x.publishedAt ? new Date().toISOString() : x.publishedAt } : x)));
    try {
      const res = await fetch(`${base}/${w.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isLive }) });
      if (!res.ok) throw new Error(await apiMessage(res, "Could not change the widget"));
      notify.success(isLive ? `${w.name} is live` : `${w.name} is off`, { description: isLive ? "Visitors see it from their next page load." : "Visitors no longer see it." });
      router.refresh();
    } catch (err) {
      setWidgets(before);
      notify.fromError(err, "Could not change the widget");
    } finally {
      setBusy(null);
    }
  }

  async function remove(w: WidgetListItem) {
    if (!(await confirm({ title: `Delete "${w.name}"?`, description: "It disappears from your site and its settings are gone for good. Your testimonials are not affected.", confirmLabel: "Delete widget", tone: "danger" }))) return;
    setBusy(w.id);
    try {
      const res = await fetch(`${base}/${w.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await apiMessage(res, "Could not delete the widget"));
      setWidgets((list) => list.filter((x) => x.id !== w.id));
      setQuota((q) => ({ ...q, current: q.current - 1, allowed: q.limit === null || q.current - 1 < q.limit }));
      notify.success("Widget deleted");
      router.refresh();
    } catch (err) {
      notify.fromError(err, "Could not delete the widget");
    } finally {
      setBusy(null);
    }
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    setBusy(renaming.id);
    setRenameError(null);
    try {
      const res = await fetch(`${base}/${renaming.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
      if (!res.ok) {
        setRenameError(await apiMessage(res, "Could not rename the widget"));
        return;
      }
      const { widget } = await res.json();
      setWidgets((list) => list.map((x) => (x.id === renaming.id ? { ...x, name: widget.name } : x)));
      setRenaming(null);
      router.refresh();
    } catch (err) {
      notify.fromError(err, "Could not rename the widget");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-medium tracking-tight text-text">Widgets</h2>
          <p className="max-w-xl text-sm text-text-muted">Show your testimonials in different places on your site, each widget with its own look, pages and timing.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-text-muted" aria-live="polite">
            {quotaLabel(quota)}
          </span>
          <Button type="button" size="sm" onClick={() => create()} loading={adding} disabled={adding}>
            <Icon name="add-circle" size="sm" />
            Add widget
          </Button>
        </div>
      </div>

      {hint && (
        <p role="note" className="flex flex-wrap items-center gap-x-2 rounded-card border bg-brand-soft/40 px-4 py-3 text-sm text-text-muted">
          {hint}
          <Link href="/settings/billing" className="font-medium text-text underline underline-offset-4 hover:text-brand">
            See plans
          </Link>
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {widgets.map((w, i) => {
          const layout = layoutInfo(w.template);
          const status = widgetStatus(w);
          const working = busy === w.id;
          return (
            <li key={w.id}>
              <Card padding="md" className="flex h-full flex-col gap-4">
                <div className="flex items-start gap-3">
                  <LayoutSketch id={w.template} />
                  <div className="min-w-0 flex-1">
                    <Link href={editorHref(w.id)} className="block truncate font-medium text-text hover:text-brand">
                      {w.name}
                    </Link>
                    <p className="text-xs text-text-muted">
                      {layout.name} · {layout.placement === "floating" ? "floats in a corner" : "sits in your page"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`More actions for ${w.name}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} disabled={working}>
                        <Icon name="menu-dots" size="sm" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenaming(w);
                          setNewName(w.name);
                          setRenameError(null);
                        }}
                      >
                        <Icon name="pen" size="sm" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => create(w.id)}>
                        <Icon name="copy" size="sm" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setCopying(w)}>
                        <Icon name="copy" size="sm" /> Copy style to...
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive disabled={widgets.length <= 1} onSelect={() => remove(w)}>
                        <Icon name="trash-bin-minimalistic" size="sm" /> {widgets.length <= 1 ? "Delete (the last widget stays)" : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {i === 0 && (
                    <Badge variant="outline" title="The first widget: the plain embed spot (data-vouchreel-embed) and experiments use it">
                      Primary
                    </Badge>
                  )}
                  <Badge variant={status.tone === "success" ? "success" : status.tone === "info" ? "info" : "neutral"}>{status.label}</Badge>
                  {status.pendingChanges && <Badge variant="warning">Unpublished changes</Badge>}
                </div>

                {numbersLine(w, stats[w.id]) && (
                  <p className="text-xs tabular-nums text-text-muted" aria-label="Last 30 days">
                    {numbersLine(w, stats[w.id])}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3">
                  <label className="flex items-center gap-2 text-xs text-text-muted">
                    <Switch checked={w.isLive} disabled={working} onCheckedChange={(v) => setLive(w, v)} aria-label={`${w.name} is shown to visitors`} />
                    Show on my site
                  </label>
                  <Link href={editorHref(w.id)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    Edit
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-text-muted">Numbers are for the last 30 days. Visits from before widgets were told apart count in Analytics for the whole space.</p>

      <details className="group rounded-card border bg-surface">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-text">
          How to put widgets on your site
          <Icon name="alt-arrow-down" size="sm" className="text-text-subtle transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t px-5 py-5">
          <p className="text-sm text-text-muted">
            One script serves every widget in this space: add it once to each page. Widgets that float in a corner then need nothing else. Widgets that sit in your page need a spot: open the widget and copy its
            spot from the Install step.
          </p>
          {embedKey ? <EmbedSnippet embedKey={embedKey} compact /> : null}
          <InstallCheck spaceId={spaceId} />
        </div>
      </details>

      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <form onSubmit={rename}>
            <DialogHeader>
              <DialogTitle>Rename widget</DialogTitle>
              <DialogDescription>Only you see the name. It helps you tell your widgets apart.</DialogDescription>
            </DialogHeader>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} aria-label="Widget name" aria-invalid={renameError ? true : undefined} autoFocus />
            {renameError && (
              <p role="alert" className="mt-2 text-xs text-danger-foreground">
                {renameError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy === renaming?.id} disabled={!newName.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {copying && <CopyStyleDialog spaceId={spaceId} widget={copying} onClose={() => setCopying(null)} />}

      {upgrade && <UpgradePromptModal feature="widget-limit" onClose={() => setUpgrade(false)} />}
    </div>
  );
}
