export interface AuditLinkInput {
  entityType: string;
  entityId: string | null;
  changes?: Record<string, unknown>;
}

export interface AuditLink {
  href: string;
  label: string;
}

/**
 * Where to look at the thing an audit entry changed. Users open the Users tab searched by id; the
 * other tabs have no per-item address, so they open the tab that holds the item. The thing may
 * have been deleted since, in which case the tab simply does not show it.
 */
export function auditEntryLink(entry: AuditLinkInput): AuditLink | null {
  switch (entry.entityType) {
    case "user":
      return entry.entityId ? { href: `/admin?tab=users&q=${encodeURIComponent(entry.entityId)}`, label: "Open user" } : null;
    case "plan":
      return { href: "/admin?tab=plans", label: "Open plans" };
    case "job":
      return { href: "/admin?tab=videos", label: "Open jobs" };
    case "video": {
      const kind = entry.changes?.kind;
      return { href: `/admin?tab=moderation${kind === "ai" || kind === "review" ? `&kind=${kind}` : ""}`, label: "Open moderation" };
    }
    case "worker":
      return { href: "/admin?tab=system", label: "Open system" };
    case "setting":
      return { href: "/admin?tab=payments", label: "Open payments" };
    default:
      return null;
  }
}
