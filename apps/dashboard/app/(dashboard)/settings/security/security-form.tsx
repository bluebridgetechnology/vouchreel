"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { twoFactorApi } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import { Card } from "@/components/ui/card";

type Step = "idle" | "password" | "scan" | "codes" | "disable" | "regenerate";

export function SecurityForm({ enabled, email }: { enabled: boolean; email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(next: Step = "idle") {
    setStep(next);
    setPassword("");
    setCode("");
    setError(null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await twoFactorApi.enable({ password });
      if (res.error || !res.data || !("totpURI" in res.data)) throw new Error(res.error?.message || "Could not start setup");
      setBackupCodes(res.data.backupCodes);
      setSecret(new URL(res.data.totpURI).searchParams.get("secret") ?? "");
      setQr(await QRCode.toDataURL(res.data.totpURI, { margin: 1, width: 192 }));
      setPassword("");
      setStep("scan");
    });
  };

  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await twoFactorApi.verifyTotp({ code: code.replace(/\s+/g, "") });
      if (res.error) throw new Error(res.error.message || "That code did not work");
      setCode("");
      setStep("codes");
      router.refresh();
    });
  };

  const disable = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await twoFactorApi.disable({ password });
      if (res.error) throw new Error(res.error.message || "Could not turn it off");
      notify.success("Two-factor sign-in is off");
      reset();
      router.refresh();
    });
  };

  const regenerate = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await twoFactorApi.generateBackupCodes({ password });
      if (res.error || !res.data) throw new Error(res.error?.message || "Could not make new codes");
      setBackupCodes(res.data.backupCodes);
      setPassword("");
      setStep("codes");
    });
  };

  return (
    <Card variant="flat" className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Two-factor sign-in</h2>
          <p className="text-sm text-text-muted">
            {enabled || step === "codes" ? "On. You will be asked for a code each time you sign in." : "Off. Your account is protected by your password alone."}
          </p>
        </div>
        {step === "idle" && !enabled && <Button onClick={() => setStep("password")}>Turn on</Button>}
        {step === "idle" && enabled && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("regenerate")}>
              New backup codes
            </Button>
            <Button variant="outline-danger" onClick={() => setStep("disable")}>
              Turn off
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger-foreground">
          {error}
        </div>
      )}

      {(step === "password" || step === "disable" || step === "regenerate") && (
        <form onSubmit={step === "password" ? start : step === "disable" ? disable : regenerate} className="max-w-sm space-y-4">
          <p className="text-sm text-text-muted">Confirm it is you: enter the password for {email}.</p>
          <Field label="Password" htmlFor="security-password">
            <Input id="security-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} variant={step === "disable" ? "danger" : "primary"}>
              {step === "password" ? "Continue" : step === "disable" ? "Turn off" : "Make new codes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => reset()}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step === "scan" && (
        <form onSubmit={confirm} className="max-w-sm space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-text-muted">
            <li>Open an authenticator app (Google Authenticator, 1Password, Authy…).</li>
            <li>Scan this code, or type the key by hand.</li>
            <li>Enter the 6-digit code it shows.</li>
          </ol>
          {qr && (
            <img src={qr} alt="QR code for your authenticator app" width={192} height={192} className="rounded-control border bg-text-on-accent p-1" />
          )}
          <p className="break-all font-mono text-xs text-text-muted">
            Key: <span data-testid="totp-secret">{secret}</span>
          </p>
          <Field label="Code from the app" htmlFor="security-code">
            <Input id="security-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              Turn on
            </Button>
            <Button type="button" variant="outline" onClick={() => reset()}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step === "codes" && (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Save these backup codes somewhere safe. Each works once if you lose your phone. <strong className="text-text">They are not shown again.</strong>
          </p>
          <ul data-testid="backup-codes" className="grid max-w-sm grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map((c) => (
              <li key={c} className="rounded-control border bg-surface-sunken px-2.5 py-1.5">
                {c}
              </li>
            ))}
          </ul>
          <Button onClick={() => reset()}>I have saved them</Button>
        </div>
      )}
    </Card>
  );
}
