"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface InviteDetails {
  id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  expiresAt: string;
  inviterName: string;
  inviterEmail: string;
}

export default function InviteAcceptancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);

  useEffect(() => {
    async function verifyInvite() {
      try {
        const res = await fetch(`/api/team/invites/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || "Invalid or expired invitation.");
        }
        setInvite(data.invite);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invitation.");
      } finally {
        setLoading(false);
      }
    }
    verifyInvite();
  }, [token]);

  async function handleAccept() {
    try {
      setAccepting(true);
      setError(null);

      const res = await fetch("/api/team/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          // If not logged in, redirect to login with callback
          router.push(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
          return;
        }
        throw new Error(data?.error?.message || "Failed to accept invitation.");
      }

      setAcceptSuccess(true);
      setTimeout(() => {
        router.push("/spaces");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error accepting invitation");
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground animate-pulse">
          Validating invitation link…
        </div>
      </main>
    );
  }

  if (error || !invite) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-lg space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xl">
            ✕
          </div>
          <h1 className="text-xl font-bold">Invalid or Expired Invitation</h1>
          <p className="text-sm text-muted-foreground">
            {error || "This team invitation is no longer valid or has already expired."}
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (acceptSuccess) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-lg space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl font-bold">
            ✓
          </div>
          <h1 className="text-2xl font-bold">Invitation Accepted!</h1>
          <p className="text-sm text-muted-foreground">
            You are now a member of {invite.inviterName}&apos;s team. Redirecting to your spaces…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
            VR
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Team Invitation</h1>
          <p className="text-sm text-muted-foreground">
            <strong>{invite.inviterName}</strong> ({invite.inviterEmail}) has invited you to join their workspace on Vouchreel.
          </p>
        </div>

        <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invited Email:</span>
            <span className="font-medium text-foreground">{invite.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned Role:</span>
            <span className="font-semibold capitalize text-primary">{invite.role}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled={accepting}
            onClick={handleAccept}
            className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
          >
            {accepting ? "Joining Team…" : "Accept Invitation & Join Team"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Not logged in? Clicking Accept will prompt you to log in or create an account.
          </p>
        </div>
      </div>
    </main>
  );
}
