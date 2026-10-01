"use client";

import { Icon as Iconify, addCollection } from "@iconify/react";
import { iconCollection, type IconName } from "@/lib/icons.generated";
import { cn } from "@/lib/utils";

// Registered once; icons render offline (no Iconify API requests).
addCollection(iconCollection);

const sizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
} as const;

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: IconName;
  size?: keyof typeof sizes;
}

/** Solar Outline icon. Colour follows `currentColor`; size via the `size` prop. */
export function Icon({ name, size = "md", className, ...props }: IconProps) {
  return (
    <span
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn("inline-flex shrink-0", sizes[size], className)}
      {...props}
    >
      <Iconify icon={`${iconCollection.prefix}:${name}-outline`} className="size-full" />
    </span>
  );
}
