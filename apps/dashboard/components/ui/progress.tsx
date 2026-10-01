"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value}
    className={cn("h-2 w-full overflow-hidden rounded-pill bg-surface-sunken", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full rounded-pill bg-brand transition-[width] duration-(--duration-slow) ease-(--ease-out)"
      style={{ width: `${value ?? 0}%` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = "Progress";
