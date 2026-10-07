"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function WithdrawForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function withdraw() {
    setState("working");
    try {
      const res = await fetch("/api/consent/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Something went wrong. Please try again.");
      setState("done");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="rounded-card bg-success-soft p-4 text-sm text-success-foreground">
        Done. Your agreement is withdrawn, any video made from your testimonial has been removed, and no new one will be made.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {state === "error" && (
        <p role="alert" className="rounded-card bg-danger-soft p-3 text-sm text-danger-foreground">
          {message}
        </p>
      )}
      <Button variant="danger" size="lg" onClick={withdraw} loading={state === "working"}>
        Withdraw my agreement
      </Button>
    </div>
  );
}
