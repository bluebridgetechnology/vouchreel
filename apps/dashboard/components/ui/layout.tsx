import * as React from "react";
import { cn } from "@/lib/utils";

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-(--container-page) px-5 sm:px-8", className)} {...props} />;
}

export function Section({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("py-(--space-section)", className)} {...props} />;
}

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}

export function PageHeader({ title, description, actions, eyebrow, className, ...props }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)} {...props}>
      <div className="space-y-1.5">
        {eyebrow && <div>{eyebrow}</div>}
        <h1 className="text-3xl font-medium">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
