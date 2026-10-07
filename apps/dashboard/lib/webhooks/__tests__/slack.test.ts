import { describe, expect, it } from "vitest";
import { slackBody, slackText } from "../slack";
import { WEBHOOK_EVENTS, createWebhookEndpointSchema, updateWebhookEndpointSchema } from "@/lib/validations/webhooks";

describe("Slack message for each webhook event", () => {
  const payloads: Record<string, Record<string, unknown>> = {
    "testimonial.created": { testimonial: { customerName: "Ada Lovelace", quote: "It changed how we sell." } },
    "testimonial.updated": { testimonial: { customerName: "Ada Lovelace" } },
    "testimonial.deleted": { testimonial: { customerName: "Ada Lovelace" } },
    "submission.received": { submission: { customerName: "Grace Hopper", text: "Loved it." } },
    "submission.approved": { submission: { customerName: "Grace Hopper" } },
    "conversion.tracked": { event: { eventType: "convert" } },
  };

  it("has a readable line naming the person and the space, for every event the product sends", () => {
    for (const event of WEBHOOK_EVENTS) {
      const text = slackText(event, payloads[event], "Acme Reviews");
      expect(text, event).toContain("Acme Reviews");
      expect(text.length, event).toBeGreaterThan(20);
      if (event !== "conversion.tracked") expect(text, event).toMatch(/Ada Lovelace|Grace Hopper/);
    }
  });

  it("includes the quote for new testimonials and submissions, as a Slack quote", () => {
    expect(slackText("testimonial.created", payloads["testimonial.created"], "S")).toContain("\n>It changed how we sell.");
    expect(slackText("submission.received", payloads["submission.received"], "S")).toContain("\n>Loved it.");
  });

  it("wraps the line as {\"text\": ...} and nothing else", () => {
    const body = JSON.parse(slackBody("testimonial.created", payloads["testimonial.created"], "S"));
    expect(Object.keys(body)).toEqual(["text"]);
  });

  it("stops a customer's words from becoming a mention, link or channel ping", () => {
    const text = slackText("testimonial.created", { testimonial: { customerName: "<!channel> & <@U123>", quote: "<https://evil.example|click> <!here>" } }, "<!everyone>");
    expect(text).not.toMatch(/<[!@h]/);
    expect(text).toContain("&lt;!channel&gt; &amp; &lt;@U123&gt;");
  });

  it("cuts a long quote to one short line", () => {
    const text = slackText("testimonial.created", { testimonial: { customerName: "A", quote: `${"word ".repeat(200)}\nsecond line` } }, "S");
    expect(text.split("\n>")[1].length).toBeLessThanOrEqual(200);
    expect(text.split("\n>")[1]).not.toContain("\n");
  });

  it("copes with a payload missing its names", () => {
    expect(slackText("submission.received", {}, "S")).toContain("a customer");
    expect(slackText("testimonial.deleted", {}, "")).toContain("your space");
  });

  it("has a test message", () => {
    expect(slackText("test", {}, "Acme")).toMatch(/test message/i);
  });
});

describe("webhook endpoint format", () => {
  const base = { url: "https://hooks.slack.com/services/T000/B000/XXX", events: ["testimonial.created"] };
  it("defaults to json, accepts slack, rejects anything else", () => {
    expect(createWebhookEndpointSchema.parse(base).format).toBe("json");
    expect(createWebhookEndpointSchema.parse({ ...base, format: "slack" }).format).toBe("slack");
    expect(createWebhookEndpointSchema.safeParse({ ...base, format: "xml" }).success).toBe(false);
    expect(updateWebhookEndpointSchema.parse({}).format).toBeUndefined();
    expect(updateWebhookEndpointSchema.parse({ format: "slack" }).format).toBe("slack");
  });
});
