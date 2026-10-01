"use client";

import * as React from "react";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof MenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-(--z-dropdown) min-w-44 rounded-card border bg-surface-raised p-1.5 text-text shadow-float animate-pop-in",
        className,
      )}
      {...props}
    />
  </MenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof MenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <MenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2.5 rounded-control px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-sunken data-[disabled]:opacity-50",
      destructive && "text-danger-foreground data-[highlighted]:bg-danger-soft",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-3 py-1.5 text-xs text-text-subtle", className)} {...props} />;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <MenuPrimitive.Separator className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} />;
}
