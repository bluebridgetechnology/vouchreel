import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-medium transition-colors duration-(--duration-fast) disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-text-on-accent shadow-xs hover:bg-brand-hover",
        ink: "bg-surface-inverse text-text-inverse hover:opacity-90",
        outline: "border border-border-strong bg-surface text-text hover:bg-surface-sunken",
        soft: "bg-brand-soft text-brand-soft-foreground hover:opacity-80",
        ghost: "text-text-muted hover:bg-surface-sunken hover:text-text",
        danger: "bg-danger text-text-on-accent hover:opacity-90",
        success: "bg-success text-text-on-accent shadow-xs hover:bg-success/90",
        warning: "bg-warning text-on-warning shadow-xs hover:bg-warning/90",
        "outline-danger": "border border-danger/30 text-danger-foreground hover:bg-danger-soft",
        "ghost-brand": "text-brand hover:bg-brand-soft",
        "ghost-danger": "text-text-muted hover:bg-danger-soft hover:text-danger-foreground",
        link: "rounded-control px-0 text-brand underline-offset-4 hover:underline",
        "link-muted": "rounded-control px-0 text-text-muted underline-offset-4 hover:text-text hover:underline",
        "link-danger": "rounded-control px-0 text-danger-foreground underline-offset-4 hover:underline",
        "link-success": "rounded-control px-0 text-success-foreground underline-offset-4 hover:underline",
        inverse: "bg-surface text-text shadow-sm hover:bg-surface-sunken",
        "outline-inverse": "border border-text-inverse/30 text-text-inverse hover:bg-text-inverse/10",
      },
      size: {
        sm: "h-8 px-3.5 text-xs",
        md: "h-10 px-5",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-9 text-base",
        bare: "h-auto",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <span className="size-4 animate-spin rounded-pill border-2 border-current border-t-transparent" aria-hidden />
            )}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
