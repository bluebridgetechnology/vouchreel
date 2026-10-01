import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/marketing/logo";
import { MobileNav } from "@/components/marketing/mobile-nav";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteHeader() {
  const session = await getSession();
  const signedIn = Boolean(session?.user);

  return (
    <header className="sticky top-0 z-(--z-nav) bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-(--container-page) items-center justify-between gap-4 px-5 sm:px-8">
        <Logo />

        <nav aria-label="Marketing" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-pill px-4 py-2 text-sm text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button asChild variant="ink" className="hidden md:inline-flex">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden md:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="ink" className="hidden md:inline-flex">
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
          <MobileNav links={links} signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
