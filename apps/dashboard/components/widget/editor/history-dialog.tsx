"use client";

import { useEffect, useState } from "react";
import type { UpdateWidgetConfigInput } from "@/lib/validations/widget-config";
import { layoutInfo } from "@/lib/widget-editor/layouts";
import { versionSummary } from "@/lib/widgets/history";
import { timeAgo } from "@/lib/time-ago";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Version {
  id: string;
  createdAt: string;
  source: "publish" | "experiment" | "before";
  config: UpdateWidgetConfigInput;
  changed: string[] | null;
  isLive: boolean;
}

/**
 * The widget's past published versions. "Restore" loads one into the editor as unpublished changes: the site keeps
 * showing what it shows now until the owner publishes, and Undo still goes back.
 */
export function HistoryDialog({ url, onRestore, onClose }: { url: string; onRestore: (config: UpdateWidgetConfigInput) => void; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: { versions: Version[] }) => !cancelled && setVersions(data.versions))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>Restoring a version loads it into the editor. Nothing changes on your site until you publish.</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto" aria-live="polite">
          {failed ? (
            <p role="alert" className="text-sm text-danger-foreground">
              We could not load the history. Close this and try again.
            </p>
          ) : versions === null ? (
            <div className="h-20 animate-pulse rounded-card bg-surface-sunken" aria-label="Loading the history" />
          ) : versions.length === 0 ? (
            <p className="text-sm text-text-muted">No history yet. Each time you publish a change, the version it replaces is kept here, so you can go back.</p>
          ) : (
            <ul className="divide-y">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                      {v.source === "before" ? "Before history" : timeAgo(v.createdAt)}
                      {v.isLive && <Badge variant="success">Live now</Badge>}
                    </p>
                    <p className="text-xs text-text-muted">
                      {layoutInfo(v.config.template).name}. {versionSummary(v.source, v.changed)}
                    </p>
                  </div>
                  {!v.isLive && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onRestore(v.config);
                        onClose();
                      }}
                    >
                      Restore
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
