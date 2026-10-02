"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";
import { Icon } from "@/components/ui/icon";

/** Mount once near the root. Prefer the `notify` helpers in lib/notify.ts over importing this. */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
      duration={4500}
      visibleToasts={4}
      icons={{
        success: <Icon name="check-circle" className="text-success" />,
        error: <Icon name="danger-circle" className="text-danger" />,
        warning: <Icon name="danger-triangle" className="text-warning" />,
        info: <Icon name="info-circle" className="text-info" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!gap-3 !rounded-card !border !border-border !bg-surface-raised !p-4 !text-text !shadow-float !font-sans",
          title: "!text-sm !font-medium",
          description: "!text-xs !text-text-muted",
          closeButton: "!border-border !bg-surface-raised !text-text-muted hover:!bg-surface-sunken",
          actionButton: "!rounded-pill !bg-brand !text-text-on-accent",
          cancelButton: "!rounded-pill !bg-surface-sunken !text-text",
        },
      }}
    />
  );
}
