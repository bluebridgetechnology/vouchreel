"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/notify";
import { timeAgo } from "@/lib/time-ago";
import type { ModerationItem } from "@/lib/admin/moderation";

const REASON_MIN = 5;
const REASON_MAX = 500;
const date = (d: Date) => new Date(d).toISOString().slice(0, 10);

export function ModerationManager({ items }: { items: ModerationItem[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<ModerationItem | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function takeDown() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/moderation/${target.kind}/${target.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.details?.reason?.[0] || data?.error?.message || "Could not take the video down");
      notify.success("Video taken down. Its owner has been told.");
      setTarget(null);
      setReason("");
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Could not take the video down");
    } finally {
      setBusy(false);
    }
  }

  const trimmed = reason.trim();
  const stateBadge = (v: ModerationItem) =>
    v.removed ? <Badge variant="neutral">Taken down</Badge> : v.needsAttention ? <Badge variant="danger">Consent withdrawn</Badge> : <Badge variant="success">Live</Badge>;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Video</TableHead>
            <TableHead className="hidden md:table-cell">Owner</TableHead>
            <TableHead className="hidden md:table-cell">Says</TableHead>
            <TableHead className="hidden md:table-cell">Permission</TableHead>
            <TableHead className="hidden md:table-cell">State</TableHead>
            <TableHead className="hidden text-right md:table-cell">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((v) => (
            <TableRow key={`${v.kind}-${v.id}`}>
              <TableCell>
                <div className="font-medium">
                  {v.kind === "ai" ? "AI video" : "Review video"} · {v.template}
                </div>
                <div className="text-xs text-text-muted">{timeAgo(v.createdAt)}</div>
                {v.outputUrl && (
                  <a href={v.outputUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                    Open file
                  </a>
                )}
                {/* On a phone the other columns are folded in here, so the Take down button is always on screen */}
                <div className="mt-2 space-y-1 md:hidden">
                  <div className="max-w-[12rem] truncate text-xs" title={v.ownerEmail ?? undefined}>{v.ownerEmail ?? "Deleted user"}</div>
                  <div className="line-clamp-3 text-xs text-text-muted">{v.content}</div>
                  <div>{stateBadge(v)}</div>
                  {!v.removed && v.outputUrl && (
                    <Button size="sm" variant={v.needsAttention ? "danger" : "outline"} onClick={() => setTarget(v)}>
                      Take down
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="max-w-[16rem] truncate" title={v.ownerEmail ?? undefined}>{v.ownerEmail ?? "Deleted user"}</div>
                <div className="text-xs text-text-muted">{v.spaceName}</div>
              </TableCell>
              <TableCell className="hidden max-w-xs md:table-cell">
                <div className="line-clamp-4 text-xs">{v.content}</div>
                {v.attribution && <div className="mt-1 text-xs text-text-muted">- {v.attribution}</div>}
              </TableCell>
              <TableCell className="hidden text-xs md:table-cell">
                {v.consent && (
                  <div className="space-y-1">
                    <div>
                      Given {date(v.consent.grantedAt)} ({v.consent.source === "collect_form" ? "collect form" : "email"})
                    </div>
                    {v.consent.revokedAt && <Badge variant="danger">Withdrawn {date(v.consent.revokedAt)}</Badge>}
                    {!v.consent.currentWording && <div className="text-text-muted">Older wording ({v.consent.textVersion})</div>}
                  </div>
                )}
                {v.rightsConfirmedAt && <div>Owner confirmed rights {date(v.rightsConfirmedAt)}</div>}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {v.removed ? (
                  <div className="space-y-1 text-xs">
                    <Badge variant="neutral">Taken down</Badge>
                    <div className="text-text-muted">
                      {timeAgo(v.removed.at)}
                      {v.removed.byEmail ? ` by ${v.removed.byEmail}` : ""}
                    </div>
                    {v.removed.reason && <div>{v.removed.reason}</div>}
                  </div>
                ) : v.needsAttention ? (
                  <Badge variant="danger">Consent withdrawn</Badge>
                ) : (
                  <Badge variant="success">Live</Badge>
                )}
              </TableCell>
              <TableCell className="hidden text-right md:table-cell">
                {!v.removed && v.outputUrl && (
                  <Button size="sm" variant={v.needsAttention ? "danger" : "outline"} onClick={() => setTarget(v)}>
                    Take down
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-text-muted">
                No videos match.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={target !== null} onOpenChange={(open) => !open && !busy && setTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take this video down?</DialogTitle>
            <DialogDescription>
              The file is deleted and its link stops working. This cannot be undone and the owner's credit is not refunded. The owner
              ({target?.ownerEmail ?? "unknown"}) is told and sees your reason.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason" htmlFor="takedown-reason" hint={`${trimmed.length}/${REASON_MAX} characters, at least ${REASON_MIN}`}>
            <Textarea id="takedown-reason" rows={4} value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={takeDown} loading={busy} disabled={trimmed.length < REASON_MIN}>
              Take down
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
