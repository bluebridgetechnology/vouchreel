import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const cardVariants = cva("text-text", {
  variants: {
    variant: {
      default: "rounded-card border bg-surface shadow-card",
      flat: "rounded-card border bg-surface",
      sunken: "rounded-card bg-surface-sunken",
      pink: "rounded-panel bg-tint-pink text-tint-foreground",
      lime: "rounded-panel bg-tint-lime text-tint-foreground",
      peach: "rounded-panel bg-tint-peach text-tint-foreground",
      cream: "rounded-panel bg-tint-cream text-tint-foreground",
      inverse: "rounded-panel bg-surface-inverse text-text-inverse",
    },
    padding: { none: "", sm: "p-4", md: "p-4 sm:p-6", lg: "p-5 sm:p-8" },
    interactive: {
      true: "transition-[transform,box-shadow] duration-(--duration-base) ease-(--ease-out) hover:-translate-y-0.5 hover:shadow-float",
      false: "",
    },
  },
  defaultVariants: { variant: "default", padding: "none", interactive: false },
});

/** Elements a card can be, when the page structure calls for more than a div (a labelled section, a form, a list). */
export type CardTag = "div" | "section" | "article" | "aside" | "form" | "ul";

export interface CardProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof cardVariants> {
  as?: CardTag;
}

export function Card({ as: Tag = "div", className, variant, padding, interactive, ...props }: CardProps) {
  const Element: React.ElementType = Tag;
  return <Element className={cn(cardVariants({ variant, padding, interactive }), className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1 p-4 pb-0 sm:p-6 sm:pb-0", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-medium", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-text-muted", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-6", className)} {...props} />;
}
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 p-4 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}
