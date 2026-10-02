import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookDeliveries, webhookEndpoints } from "@/lib/db/schema";
import { notifySpaceOwner } from "@/lib/notifications/service";

// Backoff schedule in seconds: attempt 1 -> 30s, attempt 2 -> 5m, attempt 3 -> 30m
const RETRY_BACKOFF_SECONDS = [30, 300, 1800];

/**
 * Executes delivery of a webhook event to the target endpoint URL.
 * Records the response, updates attempt count, and schedules retry if failed.
 */
export async function attemptDelivery(
  deliveryId: string,
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const body = JSON.stringify({
    event,
    data: payload,
    timestamp: new Date().toISOString(),
  });

  const signature = createHmac("sha256", secret).update(body).digest("hex");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vouchreel-Signature": `sha256=${signature}`,
        "X-Vouchreel-Event": event,
        "User-Agent": "Vouchreel-Webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    const responseBody = await response
      .text()
      .catch(() => "")
      .then((t) => t.substring(0, 1024));

    if (response.ok) {
      const [current] = await db
        .select({ count: webhookDeliveries.attemptCount })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId));

      await db
        .update(webhookDeliveries)
        .set({
          status: "success",
          httpStatus: response.status,
          responseBody,
          attemptCount: (current?.count ?? 0) + 1,
          completedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId));
    } else {
      await markDeliveryFailure(deliveryId, response.status, responseBody);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Network/timeout error";
    await markDeliveryFailure(deliveryId, null, message);
  }
}

async function markDeliveryFailure(
  deliveryId: string,
  httpStatus: number | null,
  responseBody: string
): Promise<void> {
  const [delivery] = await db
    .select({
      attemptCount: webhookDeliveries.attemptCount,
      maxAttempts: webhookDeliveries.maxAttempts,
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId));

  if (!delivery) return;

  const nextAttempt = delivery.attemptCount + 1;
  const isExhausted = nextAttempt >= delivery.maxAttempts;

  let nextRetryAt: Date | null = null;
  if (!isExhausted) {
    const delaySec =
      RETRY_BACKOFF_SECONDS[delivery.attemptCount] ??
      RETRY_BACKOFF_SECONDS[RETRY_BACKOFF_SECONDS.length - 1];
    nextRetryAt = new Date(Date.now() + delaySec * 1000);
  }

  await db
    .update(webhookDeliveries)
    .set({
      status: isExhausted ? "failed" : "retrying",
      httpStatus,
      responseBody: responseBody.substring(0, 1024),
      attemptCount: nextAttempt,
      nextRetryAt,
      ...(isExhausted ? { completedAt: new Date() } : {}),
    })
    .where(eq(webhookDeliveries.id, deliveryId));

  if (isExhausted) {
    const [endpoint] = await db
      .select({ id: webhookEndpoints.id, spaceId: webhookEndpoints.spaceId, url: webhookEndpoints.url })
      .from(webhookDeliveries)
      .innerJoin(webhookEndpoints, eq(webhookDeliveries.endpointId, webhookEndpoints.id))
      .where(eq(webhookDeliveries.id, deliveryId));
    if (endpoint) {
      void notifySpaceOwner(endpoint.spaceId, {
        type: "webhook.failing",
        title: "A webhook endpoint is failing",
        body: `Deliveries to ${endpoint.url} failed after ${delivery.maxAttempts} attempts.`,
        href: "/settings/webhooks",
        metadata: { endpointId: endpoint.id },
        dedupeKey: `webhook-failing:${endpoint.id}`,
      });
    }
  }
}
