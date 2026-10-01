"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";

export { toast } from "sonner";

/** Mount once near the root. Styled with token utilities. */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-card !border !border-border !bg-surface-raised !text-text !shadow-float !font-sans",
          description: "!text-text-muted",
        },
      }}
    />
  );
}
