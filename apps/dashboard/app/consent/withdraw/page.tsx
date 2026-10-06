import { consentIdFromToken, describeConsent } from "@/lib/ai-video/consent-withdrawal";
import { WithdrawForm } from "./withdraw-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Withdraw your agreement", robots: { index: false, follow: false } };

const date = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** Public page a customer reaches from the link in their confirmation email. Nothing changes until they press the button. */
export default async function WithdrawConsentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const consentId = token ? consentIdFromToken(token) : null;
  const consent = consentId ? await describeConsent(consentId) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-medium tracking-tight">Withdraw your agreement to an AI video</h1>
      {!consent || !token ? (
        <p role="alert" className="rounded-card bg-danger-soft p-4 text-sm text-danger-foreground">
          This link is not valid. Use the link in the email you were sent, or contact the business you wrote the testimonial for.
        </p>
      ) : consent.revokedAt ? (
        <p className="rounded-card bg-success-soft p-4 text-sm text-success-foreground">
          You withdrew your agreement on {date(consent.revokedAt)}. Any video made from your testimonial was removed, and no new one will be made.
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            On {date(consent.grantedAt)} you agreed that <strong className="text-text">{consent.spaceName}</strong> may turn the testimonial
            {consent.customerName ? ` from ${consent.customerName}` : ""} into a short video with an AI-generated voiceover. Your words are not
            changed in meaning, nothing of your likeness or voice is created, and the video is labelled as AI-generated.
          </p>
          <p className="text-sm text-text-muted">
            If you withdraw, any such video is removed and no new one is made. Your written testimonial itself is not affected.
          </p>
          <WithdrawForm token={token} />
        </>
      )}
    </main>
  );
}
