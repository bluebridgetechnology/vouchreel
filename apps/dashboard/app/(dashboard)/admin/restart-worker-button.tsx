"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { notify } from "@/lib/notify";

/** Asks a running worker to finish its jobs and exit; its supervisor (Docker, systemd) starts it again. */
export function RestartWorkerButton({ workerId, label }: { workerId: string; label: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function restart() {
    const ok = await confirm({
      title: `Restart this ${label.toLowerCase()}?`,
      description:
        "It finishes the jobs it is running, then exits within about a minute. It only comes back if something supervises it (Docker restart policy, systemd); otherwise it stays stopped until you start it where it is hosted.",
      confirmLabel: "Restart",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/workers/${encodeURIComponent(workerId)}/restart`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not ask the worker to restart");
      notify.success("Restart requested. The worker exits after its current jobs.");
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Could not ask the worker to restart");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" loading={busy} onClick={restart}>
      Restart
    </Button>
  );
}
