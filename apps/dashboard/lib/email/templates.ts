import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { REPORT_PALETTE as P } from "@/lib/analytics/report-theme";

/**
 * Email HTML cannot use CSS variables, so it shares the report palette (warm neutrals)
 * and the brand hex. Keep markup table-free and inline-styled for client compatibility.
 */

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface EmailContent {
  title: string;
  body?: string | null;
  cta?: { label: string; url: string } | null;
  footer?: string;
}

export function renderEmail({ title, body, cta, footer }: EmailContent): { html: string; text: string } {
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:${P.canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${P.text}">
  <div style="max-width:520px;margin:0 auto;background:${P.surface};border:1px solid ${P.border};border-radius:16px;padding:32px">
    <p style="margin:0 0 20px;font-size:13px;font-weight:500;color:${DEFAULT_BRAND_HEX}">Vouchreel</p>
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:500;line-height:1.3">${escapeHtml(title)}</h1>
    ${body ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${P.textMuted}">${escapeHtml(body)}</p>` : ""}
    ${
      cta
        ? `<a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${DEFAULT_BRAND_HEX};color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:12px 22px;border-radius:999px">${escapeHtml(cta.label)}</a>`
        : ""
    }
    <p style="margin:28px 0 0;font-size:12px;color:${P.textSubtle}">${escapeHtml(footer ?? "You can change which emails you receive in Settings → Notifications.")}</p>
  </div>
</body></html>`;

  const text = [title, body, cta ? `${cta.label}: ${cta.url}` : null, footer ?? "Manage emails: Settings → Notifications."]
    .filter(Boolean)
    .join("\n\n");

  return { html, text };
}
