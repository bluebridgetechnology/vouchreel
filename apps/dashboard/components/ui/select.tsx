"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Icon } from "@/components/ui/icon";
import { controlBase } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(controlBase, "flex h-10 items-center justify-between gap-2 px-3.5 data-[placeholder]:text-text-subtle", className)}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <Icon name="alt-arrow-down" size="sm" className="text-text-subtle" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn(
        "z-(--z-dropdown) max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-card border bg-surface-raised p-1.5 text-text shadow-float animate-pop-in",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-control py-2 pl-3 pr-8 text-sm outline-none data-[highlighted]:bg-surface-sunken data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2.5">
      <Icon name="check-read" size="sm" className="text-brand" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
