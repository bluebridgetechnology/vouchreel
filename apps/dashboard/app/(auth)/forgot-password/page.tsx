"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Em } from "@/components/ui/em";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/use-hydrated";

export default function ForgotPasswordPage() {
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Better Auth endpoint; it returns the same response whether or not the email exists
      await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo: "/reset-password" }),
      });
      // Always show success to prevent email enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Card padding="lg" className="space-y-5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-pill bg-success-soft text-success-foreground">
          <Icon name="check-circle" size="lg" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-medium">Check your email</h1>
          <p className="text-sm text-text-muted">
            If an account exists for <strong className="break-all font-medium text-text">{email}</strong>, we&apos;ve
            sent password reset instructions.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/login">Back to login</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-medium">
          Reset <Em>password</Em>
        </h1>
        <p className="text-sm text-text-muted">Enter your email and we&apos;ll send reset instructions</p>
      </div>

      <Card padding="lg">
        <form method="post" onSubmit={handleSubmit} className="space-y-5">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!hydrated}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-text-muted">
        Remember your password?{" "}
        <Link href="/login" className="text-text underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
