"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { twoFactorApi } from "@/lib/auth/auth-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Em } from "@/components/ui/em";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/use-hydrated";

export default function TwoFactorPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const trimmed = code.replace(/\s+/g, "");
      const result = useBackup ? await twoFactorApi.verifyBackupCode({ code: trimmed }) : await twoFactorApi.verifyTotp({ code: trimmed });
      if (result.error) {
        setError(result.error.message || "That code did not work");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-medium">
          Two-step <Em>sign-in</Em>
        </h1>
        <p className="text-sm text-text-muted">
          {useBackup ? "Enter one of your backup codes. Each works once." : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      <Card padding="lg">
        <form method="post" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger-foreground">
              {error}
            </div>
          )}
          <Field label={useBackup ? "Backup code" : "Code"} htmlFor="code">
            <Input
              id="code"
              inputMode={useBackup ? "text" : "numeric"}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={useBackup ? "xxxxx-xxxxx" : "123456"}
              required
              autoFocus
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!hydrated}>
            {loading ? "Checking…" : "Continue"}
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-text-muted">
        <button
          type="button"
          onClick={() => {
            setUseBackup((v) => !v);
            setCode("");
            setError(null);
          }}
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm underline-offset-4 hover:underline")}
        >
          {useBackup ? "Use my authenticator app" : "Use a backup code"}
        </button>
        <Link href="/login" className="underline-offset-4 hover:text-text hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
