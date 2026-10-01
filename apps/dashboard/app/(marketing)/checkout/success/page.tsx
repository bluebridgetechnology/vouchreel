import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export default function CheckoutSuccessPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <Card padding="lg" className="w-full max-w-md">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-pill bg-success-soft text-success-foreground">
          <Icon name="check-circle" size="xl" />
        </div>

        <h1 className="text-2xl font-medium">Subscription confirmed</h1>
        <p className="mt-3 text-sm text-text-muted">
          Thank you for subscribing to Vouchreel. Your account has been upgraded and your higher limits and features
          are now ready to use.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/settings/billing">View billing and subscription</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
