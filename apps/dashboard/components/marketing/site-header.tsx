import Link from "next/link";
import { getSession } from "@/lib/auth/session";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="Vouchreel home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">V</span>
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Vouchreel
          </span>
        </Link>

        <nav
          aria-label="Marketing"
          className="hidden items-center gap-8 md:flex"
        >
          <Link
            href="/#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
