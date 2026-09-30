import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="Vouchreel home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">
                V
              </span>
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Vouchreel
            </span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Video testimonials that turn visitors into customers.
          </p>
        </div>

        <nav aria-label="Product">
          <h2 className="text-sm font-semibold">Product</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/#features" className="hover:text-foreground">
                Features
              </Link>
            </li>
            <li>
              <Link href="/#how-it-works" className="hover:text-foreground">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="text-sm font-semibold">Account</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/signup" className="hover:text-foreground">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-foreground">
                Dashboard
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold">Support</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a
                href="mailto:support@vouchreel.com"
                className="hover:text-foreground"
              >
                support@vouchreel.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Vouchreel. All rights reserved.</p>
          <p>Made for teams who let their customers do the talking.</p>
        </div>
      </div>
    </footer>
  );
}
