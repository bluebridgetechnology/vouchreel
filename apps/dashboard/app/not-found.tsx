import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="font-mono text-sm font-medium text-text-muted">404</p>
        <h1 className="text-2xl font-medium tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-text-muted">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. If you followed a link to a space, it may have been deleted or
          you don&apos;t have access to it.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", size: "md" })}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
