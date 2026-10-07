import { createHash, randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, spaces } from "@/lib/db/schema";
import { log } from "@/lib/log";

export const KEY_PREFIX = "vr_live_";

/**
 * Generate a new API key. Returns the raw key (shown only once to user)
 * and the SHA-256 hash (stored in database) along with a display prefix.
 */
export function generateApiKey(): {
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  const rawSecret = randomBytes(32).toString("base64url");
  const rawKey = `${KEY_PREFIX}${rawSecret}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = `${rawKey.substring(0, KEY_PREFIX.length + 4)}...`;
  return { rawKey, keyHash, keyPrefix };
}

/**
 * Computes a SHA-256 hex digest of a raw API key.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Context returned upon successful API key authentication.
 */
export interface ApiKeyContext {
  apiKeyId: string;
  spaceId: string;
  ownerId: string;
}

/**
 * Authenticates an incoming HTTP request using Bearer API key authentication.
 * Expects header `Authorization: Bearer vr_live_...`.
 * Returns ApiKeyContext if valid and active, null otherwise.
 */
export async function authenticateApiKey(
  request: Request
): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const rawKey = match[1].trim();
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const hash = hashApiKey(rawKey);

  try {
    const [record] = await db
      .select({
        id: apiKeys.id,
        spaceId: apiKeys.spaceId,
        isActive: apiKeys.isActive,
        ownerId: spaces.ownerId,
      })
      .from(apiKeys)
      .innerJoin(spaces, eq(apiKeys.spaceId, spaces.id))
      .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.isActive, true)));

    if (!record) return null;

    // Update lastUsedAt in background without blocking request
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, record.id))
      .catch((err) => {
        log.warn("Failed to update API key lastUsedAt:", err);
      });

    return {
      apiKeyId: record.id,
      spaceId: record.spaceId,
      ownerId: record.ownerId,
    };
  } catch (error) {
    log.error("Error authenticating API key:", error);
    return null;
  }
}
