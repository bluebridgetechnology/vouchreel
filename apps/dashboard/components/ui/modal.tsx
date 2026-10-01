"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

interface ModalOverlayProps {
  /** Accessible name for the dialog (announced by screen readers). */
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Drop-in modal shell for pages that render their own panel: scrim, centring, scroll
 *  lock, focus trap, Escape to close and click-outside to close come from Radix Dialog.
 *  Render it conditionally, e.g. `{open && <ModalOverlay ...>panel</ModalOverlay>}`. */
export function ModalOverlay({ label, onClose, children }: ModalOverlayProps) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-(--z-modal) bg-scrim/60 backdrop-blur-sm animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-(--z-modal) overflow-y-auto outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <div
            className="flex min-h-full items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
