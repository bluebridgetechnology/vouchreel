import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Heights are the button's own size; the circle is 8px smaller (the button's 4px padding on each side). */
const sizes = {
  md: { button: "h-10 ps-5 pe-12 hover:ps-12 hover:pe-5", circle: "size-8", slide: "group-hover:right-[calc(100%-2.25rem)]" },
  lg: { button: "h-12 ps-6 pe-14 hover:ps-14 hover:pe-6", circle: "size-10", slide: "group-hover:right-[calc(100%-2.75rem)]" },
  xl: { button: "h-14 ps-7 pe-16 hover:ps-16 hover:pe-7", circle: "size-12", slide: "group-hover:right-[calc(100%-3.25rem)]" },
} as const;

/**
 * The call to action used across the marketing site: a pill with its label and a circle holding an arrow. On hover the
 * circle slides to the other end, the label moves over, and the arrow turns from pointing up-right to pointing right.
 */
export function ArrowButton({
  href,
  children,
  size = "lg",
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  size?: keyof typeof sizes;
  className?: string;
  onClick?: () => void;
}) {
  const s = sizes[size];
  return (
    <Link href={href} onClick={onClick} className={cn(buttonVariants({ size: "bare" }), "group relative w-fit overflow-hidden p-1 transition-all duration-500", s.button, className)}>
      <span className="relative z-10 transition-all duration-500">{children}</span>
      <span className={cn("absolute right-1 flex items-center justify-center rounded-pill bg-surface text-text transition-all duration-500", s.circle, s.slide)}>
        <Icon name="arrow-right" size="sm" className="-rotate-45 transition-transform duration-500 group-hover:rotate-0" />
      </span>
    </Link>
  );
}
