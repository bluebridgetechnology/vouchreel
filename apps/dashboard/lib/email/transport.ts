export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Overrides EMAIL_FROM, e.g. "Ada via Vouchreel <no-reply@vouchreel.com>". */
  from?: string;
}

export interface EmailResult {
  sent: boolean;
  /** "resend" when delivered, "log" when no provider is configured (dev). */
  provider: "resend" | "log";
  id?: string;
  error?: string;
}

const defaultFrom = () => process.env.EMAIL_FROM || "Vouchreel <no-reply@vouchreel.com>";

/**
 * Sends a transactional email. With RESEND_API_KEY set it delivers through Resend's
 * HTTP API (no SDK, works on any host). Without a key it logs the message, so local
 * development and tests never need credentials. Never throws: callers get `sent: false`.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:log] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return { sent: false, provider: "log" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: message.from || defaultFrom(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return { sent: false, provider: "resend", error: data.message || `Resend responded ${res.status}` };
    }
    return { sent: true, provider: "resend", id: data.id };
  } catch (err) {
    return { sent: false, provider: "resend", error: err instanceof Error ? err.message : "Email request failed" };
  }
}
