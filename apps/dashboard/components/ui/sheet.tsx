"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** The edge it slides in from. The dashboard's navigation uses the left; the marketing menu the right. */
  side?: "left" | "right";
  /** Draw the close button in the corner. Turn off when the sheet's own header has one. */
  showClose?: boolean;
}

const sides = {
  left: "inset-y-0 left-0 w-[min(20rem,calc(100vw-3rem))] animate-slide-in-left",
  right: "inset-y-0 right-0 w-full sm:w-96 animate-slide-in-right",
} as const;

/** A drawer that slides in from the left (the default) or right edge, used for mobile navigation. */
export const SheetContent = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ className, children, side = "left", showClose = true, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-(--z-modal) bg-surface-inverse/50 backdrop-blur-sm animate-fade-in" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn("fixed z-(--z-modal) flex flex-col bg-surface text-text shadow-float", sides[side], className)}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            aria-label="Close menu"
            className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-pill text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
          >
            <Icon name="close" size="sm" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
SheetContent.displayName = "SheetContent";
