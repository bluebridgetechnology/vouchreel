"use client";

import { useState } from "react";
import Link from "next/link";
import { UpgradePromptModal } from "@/components/billing/upgrade-prompt-modal";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  image?: string | null;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
  isOwner: boolean;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  expiresAt: string;
  createdAt: string;
}

interface TeamManagerProps {
  initialMembers: TeamMember[];
  initialInvites: TeamInvite[];
  currentUserId: string;
  isEntitled: boolean;
}

export function TeamManager({
  initialMembers,
  initialInvites,
  currentUserId,
  isEntitled,
}: TeamManagerProps) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [invites, setInvites] = useState<TeamInvite[]>(initialInvites);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  // Member actions state
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setLastInviteUrl(null);

    if (!isEntitled) {
      setShowUpgradeModal(true);
      return;
    }

    if (!inviteEmail.trim()) {
      setInviteError("Please enter an email address.");
      return;
    }

    try {
      setInviting(true);
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to send invitation.");
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}!`);
      if (data.inviteUrl) {
        setLastInviteUrl(data.inviteUrl);
      }
      setInviteEmail("");

      // Update invites list
      if (data.invite) {
        setInvites((prev) => [
          ...prev.filter((i) => i.id !== data.invite.id),
          {
            ...data.invite,
            expiresAt: new Date(data.invite.expiresAt).toISOString(),
            createdAt: new Date(data.invite.createdAt).toISOString(),
          },
        ]);
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Error sending invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleResendInvite(inviteId: string) {
    try {
      const res = await fetch(`/api/team/invites/${inviteId}/resend`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to resend invitation.");
      }

      setInviteSuccess(`Invitation resent successfully!`);
      if (data.inviteUrl) {
        setLastInviteUrl(data.inviteUrl);
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Error resending invite");
    }
  }

  async function handleCancelInvite(inviteId: string) {
    try {
      const res = await fetch(`/api/team/invites/${inviteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to cancel invitation.");
      }
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Error cancelling invite");
    }
  }

  async function handleRoleChange(memberId: string, newRole: "editor" | "viewer") {
    try {
      setLoadingMemberId(memberId);
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to update role.");
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating role");
    } finally {
      setLoadingMemberId(null);
    }
  }

  async function confirmRemoveMember() {
    if (!memberToRemove) return;

    try {
      setRemoving(true);
      const res = await fetch(`/api/team/members/${memberToRemove.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to remove member.");
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      setMemberToRemove(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error removing member");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Plan gate banner if not entitled */}
      {!isEntitled && (
        <div className="rounded-card border border-warning/30 bg-warning-soft p-5 text-warning-foreground">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-base">Multi-Seat Team Collaboration</h3>
              <p className="text-sm opacity-90 mt-0.5">
                Invite editors and viewers to manage your spaces and testimonials together.
                Team seats are exclusively available on the <strong>Agency</strong> plan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className={cn(buttonVariants({ variant: "primary", size: "md" }), "shrink-0")}
            >
              Upgrade to Agency
            </button>
          </div>
        </div>
      )}

      {/* Invite Form */}
      <section className="rounded-card border bg-card p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-medium tracking-tight">Invite New Member</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Send an invitation magic link to give collaborators access to your spaces.
        </p>

        {inviteError && (
          <div className="mt-4 rounded-control bg-destructive/10 p-3 text-sm text-destructive">
            {inviteError}
          </div>
        )}

        {inviteSuccess && (
          <div className="mt-4 rounded-control bg-success-soft p-3 text-sm text-success-foreground">
            {inviteSuccess}
          </div>
        )}

        {lastInviteUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-control border bg-muted/40 p-2.5 text-xs">
            <span className="font-medium text-foreground truncate flex-1 select-all">
              {lastInviteUrl}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(lastInviteUrl);
                alert("Invite link copied to clipboard!");
              }}
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              Copy Link
            </button>
          </div>
        )}

        <form onSubmit={handleSendInvite} className="mt-5 flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            disabled={inviting}
            className={cn(inputClass, "flex-1 text-sm")}
          />

          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
            disabled={inviting}
            className={cn(inputClass, "text-sm")}
          >
            <option value="editor">Editor (Can edit testimonials & widgets)</option>
            <option value="viewer">Viewer (Read-only access)</option>
          </select>

          <button
            type="submit"
            disabled={inviting}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            {inviting ? "Sending…" : "Send Invite"}
          </button>
        </form>
      </section>

      {/* Team Members List */}
      <section className="rounded-card border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight">Active Members</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} member{members.length === 1 ? "" : "s"} currently in this workspace.
            </p>
          </div>
        </div>

        <div className="divide-y border rounded-card overflow-hidden">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            return (
              <div
                key={member.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 bg-background"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-primary/10 font-medium text-primary text-sm uppercase">
                    {(member.name || member.email).slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{member.name}</span>
                      {isSelf && (
                        <span className="rounded-control bg-accent px-1.5 py-0.5 text-xs text-muted-foreground font-normal">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{member.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {member.isOwner ? (
                    <span className="rounded-pill bg-success-soft px-3 py-1 text-xs font-medium text-success-foreground">
                      Primary Owner
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      disabled={loadingMemberId === member.id}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value as "editor" | "viewer")
                      }
                      className={cn(inputClass, "text-xs")}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}

                  {!member.isOwner && (
                    <button
                      type="button"
                      onClick={() => setMemberToRemove(member)}
                      className={buttonVariants({ variant: "ghost-danger", size: "icon-sm" })}
                      title="Remove member"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pending Invites List */}
      {invites.length > 0 && (
        <section className="rounded-card border bg-card p-4 sm:p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-medium tracking-tight">Pending Invitations</h2>
            <p className="text-sm text-muted-foreground">
              Invitations sent that have not yet been accepted.
            </p>
          </div>

          <div className="divide-y border rounded-card overflow-hidden">
            {invites.map((invite) => {
              const expiresDate = new Date(invite.expiresAt);
              return (
                <div
                  key={invite.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 bg-background"
                >
                  <div>
                    <span className="font-medium text-sm text-foreground">{invite.email}</span>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="capitalize">{invite.role}</span>
                      <span>•</span>
                      <span>Expires {expiresDate.toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleResendInvite(invite.id)}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelInvite(invite.id)}
                      className={buttonVariants({ variant: "outline-danger", size: "sm" })}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Confirmation Modal for Member Removal */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4">
          <div className="w-full max-w-md rounded-card border bg-card p-4 sm:p-6 shadow-float space-y-4">
            <h3 className="text-lg font-medium">Remove Team Member</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove <strong>{memberToRemove.name || memberToRemove.email}</strong> from your team? They will immediately lose access to your spaces.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className={buttonVariants({ variant: "outline", size: "md" })}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={confirmRemoveMember}
                className={buttonVariants({ variant: "danger", size: "md" })}
              >
                {removing ? "Removing…" : "Remove Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradePromptModal
          feature="multi-seat"
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}
