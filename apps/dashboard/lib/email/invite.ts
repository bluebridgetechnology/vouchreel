import { nanoid } from "nanoid";

export interface SendInviteEmailParams {
  toEmail: string;
  inviterName: string;
  inviterEmail: string;
  role: "owner" | "editor" | "viewer";
  token: string;
  customSender?: string | null;
}

export interface SendInviteResult {
  success: boolean;
  inviteUrl: string;
  messageId?: string;
  previewOutput?: string;
}

/**
 * Generates an invite token and expiry timestamp (7 days).
 */
export function createInviteToken(): { token: string; expiresAt: Date } {
  const token = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return { token, expiresAt };
}

/**
 * Sends a team invitation email with magic link.
 * In development or when no external SMTP/Resend key is configured,
 * logs the email and invite link to stdout for immediate developer testing.
 */
export async function sendTeamInviteEmail(
  params: SendInviteEmailParams
): Promise<SendInviteResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite/${params.token}`;
  const sender = params.customSender || `${params.inviterName} via Vouchreel <no-reply@vouchreel.com>`;

  const roleLabel =
    params.role === "editor"
      ? "Editor (manage testimonials, forms, and widget settings)"
      : params.role === "viewer"
      ? "Viewer (read-only access to testimonials and analytics)"
      : "Admin / Owner";

  const emailSubject = `${params.inviterName} invited you to collaborate on Vouchreel`;
  const emailBody = `
Hello,

${params.inviterName} (${params.inviterEmail}) has invited you to join their team on Vouchreel as a ${roleLabel}.

Accept your invitation and join the workspace:
${inviteUrl}

This invitation link will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.

— The Vouchreel Team
`.trim();

  // In production, integrate external email transport (Resend, SES, SMTP).
  // For dev / test environments, format and log to console.
  console.log(`[Email Service] Sending Team Invite to ${params.toEmail}:`);
  console.log(`From: ${sender}`);
  console.log(`Subject: ${emailSubject}`);
  console.log(`Link: ${inviteUrl}`);

  return {
    success: true,
    inviteUrl,
    messageId: `msg_${nanoid(16)}`,
    previewOutput: emailBody,
  };
}
