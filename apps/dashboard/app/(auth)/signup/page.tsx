"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Em } from "@/components/ui/em";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Could not create account");
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
          Create an <Em>account</Em>
        </h1>
        <p className="text-sm text-text-muted">Start collecting video testimonials in minutes</p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger-foreground">
              {error}
            </div>
          )}

          <Field label="Full name" htmlFor="name">
            <Input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </Field>

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

          <Field label="Password" htmlFor="password" hint="Must be at least 8 characters">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-text underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
