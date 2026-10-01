import * as React from "react";
import { cn } from "@/lib/utils";

export const controlBase =
  "w-full rounded-control border border-border-strong bg-surface text-sm text-text placeholder:text-text-subtle outline-none transition-[border-color,box-shadow] duration-(--duration-fast) focus-visible:border-brand focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus-visible:shadow-none";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(controlBase, "h-10 px-3.5", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlBase, "min-h-24 px-3.5 py-2.5", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";
