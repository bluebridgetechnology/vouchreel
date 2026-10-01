"use client";

import Link from "next/link";

interface UpgradePromptModalProps {
  feature?:
    | "multi-seat"
    | "white-label"
    | "space-limit"
    | "testimonial-limit"
    | "exportable-reports"
    | "agency-dashboard"
    | string;
  onClose: () => void;
}

const FEATURE_MESSAGES: Record<
  string,
  { title: string; description: string; targetPlan: string }
> = {
  "multi-seat": {
    title: "Invite Team Members with RBAC",
    description:
      "Collaborate seamlessly with your team. Invite editors and viewers to manage your spaces and testimonials under one unified account.",
    targetPlan: "Agency",
  },
  "white-label": {
    title: "Unlock Full White-Label Branding",
    description:
      "Remove all Vouchreel branding, upload custom client logos, configure custom CNAME collection domains, and customize email senders.",
    targetPlan: "Agency",
  },
  "space-limit": {
    title: "Space Limit Reached",
    description:
      "You have reached the maximum number of spaces allowed on your current plan. Upgrade to create more client spaces.",
    targetPlan: "Pro or Agency",
  },
  "testimonial-limit": {
    title: "Testimonial Limit Reached",
    description:
      "You have collected the maximum number of testimonials for this space. Upgrade to unlock unlimited video and written testimonials.",
    targetPlan: "Pro",
  },
  "exportable-reports": {
    title: "Export Executive ROI Reports",
    description:
      "Generate presentation-ready PDF and CSV analytics reports with customized client branding and conversion attribution.",
    targetPlan: "Pro or Agency",
  },
  "agency-dashboard": {
    title: "Agency Multi-Client Cockpit",
    description:
      "Manage all client spaces from one centralized overview with aggregate metrics, cross-space analytics, and 1-click reports.",
    targetPlan: "Agency",
  },
};

export function UpgradePromptModal({
  feature = "multi-seat",
  onClose,
}: UpgradePromptModalProps) {
  const details = FEATURE_MESSAGES[feature] || {
    title: "Upgrade to Access This Feature",
    description:
      "This feature is available on higher subscription tiers. Upgrade your plan to get immediate access.",
    targetPlan: "Pro or Agency",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border bg-card p-4 sm:p-6 shadow-2xl space-y-5 text-card-foreground">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            ✨ {details.targetPlan} Feature
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <h3 className="text-xl font-bold tracking-tight">{details.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {details.description}
          </p>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-xs">
          <div className="font-semibold text-foreground">What you will unlock:</div>
          <ul className="space-y-1 text-muted-foreground">
            <li>✓ Multi-seat team members & roles (Editor / Viewer)</li>
            <li>✓ Remove Vouchreel branding from all widgets</li>
            <li>✓ Custom CNAME domain for collection links</li>
            <li>✓ Unlimited client spaces & testimonials</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            Maybe Later
          </button>
          <Link
            href="/settings/billing"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm text-center"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
