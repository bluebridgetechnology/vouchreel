import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** "mark" shows only the icon, for narrow places such as the collapsed sidebar. */
export function Logo({ className, href = "/", mark = false }: { className?: string; href?: string; mark?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center", className)} aria-label="Vouchreel home">
      {mark ? (
        <Image src="/brand/icon.png" alt="" width={404} height={306} priority className="h-8 w-auto" />
      ) : (
        <>
          <Image src="/brand/logo.png" alt="" width={962} height={137} priority className="h-8 w-auto dark:hidden" />
          <Image src="/brand/logo-dark.png" alt="" width={962} height={137} priority className="hidden h-8 w-auto dark:block" />
        </>
      )}
    </Link>
  );
}
