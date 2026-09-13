import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">
          Subscription Confirmed!
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Thank you for subscribing to Vouchreel. Your account has been upgraded
          and your higher limits and features are now ready to use.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="w-full rounded-lg bg-primary py-2.5 px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Spaces Dashboard
          </Link>
          <Link
            href="/settings/billing"
            className="w-full rounded-lg border bg-secondary py-2.5 px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            View Billing & Subscription
          </Link>
        </div>
      </div>
    </div>
  );
}
