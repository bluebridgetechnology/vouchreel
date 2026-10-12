import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** "mark" shows only the round mark, for narrow places such as the collapsed sidebar. */
export function Logo({ className, href = "/", mark = false }: { className?: string; href?: string; mark?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="Vouchreel home">
      <span className="flex size-9 items-center justify-center rounded-control bg-brand text-text-on-accent">
        <Icon name="play-circle" size="md" />
      </span>
      {!mark && <span className="text-xl font-medium tracking-tight">Vouchreel</span>}
    </Link>
  );
}
