"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";

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
      <Card padding="lg" className="space-y-4" role="status">
        <span className="sr-only">Validating invitation link…</span>
        <Skeleton className="mx-auto size-14 rounded-pill" />
        <Skeleton className="mx-auto h-7 w-2/3" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-12 w-full rounded-pill" />
      </Card>
    );
  }

  if (error || !invite) {
    return (
      <Card padding="lg" className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-pill bg-danger-soft text-danger-foreground">
          <Icon name="close-circle" size="lg" />
        </div>
        <h1 className="text-2xl font-medium">Invalid or expired invitation</h1>
        <p className="text-sm text-text-muted">
          {error || "This team invitation is no longer valid or has already expired."}
        </p>
        <Button asChild>
          <Link href="/login">Go to login</Link>
        </Button>
      </Card>
    );
  }

  if (acceptSuccess) {
    return (
      <Card padding="lg" className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-pill bg-success-soft text-success-foreground">
          <Icon name="check-circle" size="lg" />
        </div>
        <h1 className="text-2xl font-medium">Invitation accepted</h1>
        <p className="text-sm text-text-muted">
          You are now a member of {invite.inviterName}&apos;s team. Redirecting to your spaces…
        </p>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-pill bg-brand-soft text-brand-soft-foreground">
          <Icon name="users-group-rounded" size="lg" />
        </div>
        <h1 className="text-3xl font-medium">Team invitation</h1>
        <p className="text-sm text-text-muted">
          <strong className="font-medium text-text">{invite.inviterName}</strong>{" "}
          <span className="break-all">({invite.inviterEmail})</span> has invited you to join their workspace on
          Vouchreel.
        </p>
      </div>

      <dl className="space-y-3 rounded-card bg-surface-sunken p-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="shrink-0 text-text-muted">Invited email</dt>
          <dd className="min-w-0 truncate font-medium">{invite.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-text-muted">Assigned role</dt>
          <dd>
            <Badge variant="brand" className="capitalize">
              {invite.role}
            </Badge>
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        <Button type="button" size="lg" className="w-full" loading={accepting} onClick={handleAccept}>
          {accepting ? "Joining team…" : "Accept invitation"}
        </Button>
        <p className="text-center text-xs text-text-muted">
          Not logged in? Clicking Accept will prompt you to log in or create an account.
        </p>
      </div>
    </Card>
  );
}
