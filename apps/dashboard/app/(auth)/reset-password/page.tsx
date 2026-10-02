import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <Card padding="lg" className="space-y-5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-pill bg-danger-soft text-danger-foreground">
          <Icon name="close-circle" size="lg" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-medium">This link is no longer valid</h1>
          <p className="text-sm text-text-muted">
            Password reset links expire after one hour and can only be used once. Request a new one to continue.
          </p>
        </div>
        <Button asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </Card>
    );
  }

  return <ResetPasswordForm token={token} />;
}
