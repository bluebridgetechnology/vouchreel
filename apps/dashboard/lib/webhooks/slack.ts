import type { WebhookDispatchEvent } from "./dispatch";

/**
 * The body sent to an endpoint in "slack" format: a Slack incoming webhook accepts {"text": "..."}.
 * Names and quotes come from customers, so Slack's three special characters are escaped and long text
 * is cut, which also stops a customer's words from becoming a mention or link in the channel.
 */

const escapeSlack = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function clip(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  const oneLine = text.replace(/\s+/g, " ");
  return escapeSlack(oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine);
}

const pick = (obj: unknown, key: string): unknown => (obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined);

export function slackText(event: WebhookDispatchEvent["event"] | string, payload: Record<string, unknown>, spaceName: string): string {
  const space = clip(spaceName, 80) || "your space";
  const testimonial = payload.testimonial;
  const submission = payload.submission;
  const who = (obj: unknown) => clip(pick(obj, "customerName"), 80) || "a customer";
  const quote = (obj: unknown, key: string) => {
    const q = clip(pick(obj, key), 200);
    return q ? `\n>${q}` : "";
  };

  switch (event) {
    case "testimonial.created":
      return `:star: New testimonial from *${who(testimonial)}* in *${space}*${quote(testimonial, "quote")}`;
    case "testimonial.updated":
      return `:pencil2: Testimonial from *${who(testimonial)}* was edited in *${space}*`;
    case "testimonial.deleted":
      return `:wastebasket: A testimonial${pick(testimonial, "customerName") ? ` from *${who(testimonial)}*` : ""} was deleted in *${space}*`;
    case "submission.received":
      return `:inbox_tray: New submission from *${who(submission)}* in *${space}*, waiting for your review${quote(submission, "text")}`;
    case "submission.approved":
      return `:white_check_mark: Submission from *${who(submission)}* was approved in *${space}*`;
    case "conversion.tracked":
      return `:chart_with_upwards_trend: A conversion was tracked in *${space}*`;
    case "test":
      return `:wave: This is a test message from Vouchreel for *${space}*. If you can read it, this webhook works.`;
    default:
      return `Vouchreel: ${clip(String(event), 60)} in *${space}*`;
  }
}

export function slackBody(event: string, payload: Record<string, unknown>, spaceName: string): string {
  return JSON.stringify({ text: slackText(event, payload, spaceName) });
}
