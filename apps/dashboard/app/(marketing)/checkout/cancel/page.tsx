import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">Checkout Canceled</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your payment session was canceled and your card was not charged. You can
          explore other plans or resume checkout at any time.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/pricing"
            className="w-full rounded-lg bg-primary py-2.5 px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Return to Pricing
          </Link>
          <Link
            href="/"
            className="w-full rounded-lg border bg-secondary py-2.5 px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
