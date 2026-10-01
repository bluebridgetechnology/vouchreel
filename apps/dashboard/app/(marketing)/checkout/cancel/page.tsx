import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export default function CheckoutCancelPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <Card padding="lg" className="w-full max-w-md">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-pill bg-warning-soft text-warning-foreground">
          <Icon name="close-circle" size="xl" />
        </div>

        <h1 className="text-2xl font-medium">Checkout canceled</h1>
        <p className="mt-3 text-sm text-text-muted">
          Your payment session was canceled and your card was not charged. You can explore other plans or resume
          checkout at any time.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/pricing">Return to pricing</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
