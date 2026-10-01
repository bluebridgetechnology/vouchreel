import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label="Vouchreel home">
      <span className="flex size-9 items-center justify-center rounded-control bg-brand text-text-on-accent">
        <Icon name="play-circle" size="md" />
      </span>
      <span className="text-xl font-medium tracking-tight">Vouchreel</span>
    </Link>
  );
}
