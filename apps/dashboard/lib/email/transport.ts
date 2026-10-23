import nodemailer, { type Transporter } from "nodemailer";
import { log } from "@/lib/log";
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
  /** "smtp" or "resend" for the provider that handled it, "log" when none is configured (dev). */
  provider: "smtp" | "resend" | "log";
  id?: string;
  error?: string;
}

const defaultFrom = () => process.env.EMAIL_FROM || "Vouchreel <no-reply@vouchreel.com>";

let smtpTransport: { key: string; transporter: Transporter } | null = null;

/**
 * Returns a pooled SMTP transporter when SMTP_HOST is set, or null. SMTP_PORT defaults to 587;
 * SMTP_SECURE (implicit TLS) defaults to true only on port 465, otherwise STARTTLS is used when
 * the server offers it. SMTP_USER/SMTP_PASS are optional for relays that need no auth.
 */
function getSmtpTransport(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureEnv ? secureEnv === "true" || secureEnv === "1" : port === 465;
  const user = process.env.SMTP_USER || undefined;
  const pass = process.env.SMTP_PASS || undefined;

  // Rebuild only when the configuration changes (tests and hot reload swap env vars).
  const key = JSON.stringify([host, port, secure, user, pass]);
  if (smtpTransport?.key === key) return smtpTransport.transporter;
  smtpTransport?.transporter.close();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    pool: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    // Messages are plain text/HTML we build ourselves; never let one read files or fetch URLs.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  smtpTransport = { key, transporter };
  return transporter;
}

async function sendViaSmtp(transporter: Transporter, message: EmailMessage): Promise<EmailResult> {
  try {
    const info = await transporter.sendMail({
      from: message.from || defaultFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { sent: true, provider: "smtp", id: info.messageId };
  } catch (err) {
    return { sent: false, provider: "smtp", error: err instanceof Error ? err.message : "SMTP send failed" };
  }
}

async function sendViaResend(apiKey: string, message: EmailMessage): Promise<EmailResult> {
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

/**
 * Sends a transactional email. With SMTP_HOST set it delivers over SMTP; if that fails and
 * RESEND_API_KEY is also set, it retries through Resend's HTTP API. With only RESEND_API_KEY
 * it uses Resend. With neither it logs the message, so local development and tests never
 * need credentials. Never throws: callers get `sent: false`.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const smtp = getSmtpTransport();
  const resendKey = process.env.RESEND_API_KEY;

  if (smtp) {
    const result = await sendViaSmtp(smtp, message);
    if (result.sent || !resendKey) return result;
    log.warn(`[email] SMTP send failed, falling back to Resend: ${result.error}`);
  }

  if (resendKey) return sendViaResend(resendKey, message);

  log.info(`[email:log] to=${message.to} subject="${message.subject}"\n${message.text}`);
  return { sent: false, provider: "log" };
}
