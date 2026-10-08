"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";

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
    <ModalOverlay label="Upgrade your plan" onClose={onClose}>
      <Card variant="flat" className="w-full max-w-md p-4 sm:p-6 shadow-float space-y-5 text-text">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-pill bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            ✨ {details.targetPlan} Feature
          </div>
          <button
            type="button"
            onClick={onClose}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <h3 className="text-xl font-medium tracking-tight">{details.title}</h3>
          <p className="mt-2 text-sm text-text-muted leading-relaxed">
            {details.description}
          </p>
        </div>

        <Card variant="flat" className="bg-surface-sunken/30 p-4 space-y-2 text-xs">
          <div className="font-medium text-text">What you will unlock:</div>
          <ul className="space-y-1 text-text-muted">
            <li>✓ Multi-seat team members & roles (Editor / Viewer)</li>
            <li>✓ Remove Vouchreel branding from all widgets</li>
            <li>✓ Custom CNAME domain for collection links</li>
            <li>✓ Unlimited client spaces & testimonials</li>
          </ul>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Maybe Later
          </button>
          <Link
            href="/settings/billing"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            Upgrade Plan
          </Link>
        </div>
      </Card>
    </ModalOverlay>
  );
}
