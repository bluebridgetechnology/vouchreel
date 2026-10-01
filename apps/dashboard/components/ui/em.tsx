import { cn } from "@/lib/utils";

/** Editorial emphasis for one or two words in a headline (Playfair Display Italic). */
export function Em({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <em className={cn("accent-italic", className)} {...props} />;
}
