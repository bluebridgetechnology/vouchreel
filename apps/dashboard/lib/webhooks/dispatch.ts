import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookEndpoints, webhookDeliveries, spaces } from "@/lib/db/schema";
import { attemptDelivery } from "./deliver";
import { log } from "@/lib/log";

export interface WebhookDispatchEvent {
  event:
    | "testimonial.created"
    | "testimonial.updated"
    | "testimonial.deleted"
    | "submission.received"
    | "submission.approved"
    | "conversion.tracked";
  spaceId: string;
  payload: Record<string, unknown>;
}

/**
 * Dispatches an event to all active endpoints registered for the given space
 * that subscribe to the event type.
 * Records the delivery attempt in webhook_deliveries and launches immediate delivery.
 * Fire-and-forget: does not block the caller.
 */
export async function dispatchWebhookEvent(
  event: WebhookDispatchEvent
): Promise<void> {
  try {
    const endpoints = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        secret: webhookEndpoints.secret,
        events: webhookEndpoints.events,
        format: webhookEndpoints.format,
      })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.spaceId, event.spaceId),
          eq(webhookEndpoints.isActive, true)
        )
      );

    // Filter to endpoints that subscribe to this specific event
    const matchingEndpoints = endpoints.filter(
      (ep) => Array.isArray(ep.events) && ep.events.includes(event.event)
    );

    if (matchingEndpoints.length === 0) return;

    let spaceName = "";
    if (matchingEndpoints.some((ep) => ep.format === "slack")) {
      const [space] = await db.select({ name: spaces.name }).from(spaces).where(eq(spaces.id, event.spaceId));
      spaceName = space?.name ?? "";
    }

    for (const ep of matchingEndpoints) {
      const [delivery] = await db
        .insert(webhookDeliveries)
        .values({
          endpointId: ep.id,
          event: event.event,
          payload: event.payload,
          status: "pending",
          attemptCount: 0,
          maxAttempts: 4,
        })
        .returning({ id: webhookDeliveries.id });

      if (delivery) {
        // Asynchronously attempt immediate delivery
        attemptDelivery(delivery.id, ep.url, ep.secret, event.event, event.payload, { format: ep.format, spaceName }).catch(
          (err) => {
            log.error("Error during initial webhook delivery:", err);
          }
        );
      }
    }
  } catch (error) {
    log.error("Failed to dispatch webhook event:", error);
  }
}
