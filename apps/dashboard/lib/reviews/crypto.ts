import crypto from "crypto";
import { log } from "@/lib/log";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * The key that protects stored review-source credentials (API keys, and later OAuth tokens).
 * ENCRYPTION_KEY is required in production: a key shared with the sign-in secret would make a change of that
 * secret silently destroy every stored credential. Outside production BETTER_AUTH_SECRET is accepted so a
 * development setup needs one variable less. There is no built-in default: with neither set, this refuses to
 * run rather than protect credentials with a value anyone can read in the source.
 */
export function encryptionSecret(env: Record<string, string | undefined> = process.env): string {
  if (env.ENCRYPTION_KEY) return env.ENCRYPTION_KEY;
  if (env.NODE_ENV !== "production" && env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  throw new Error(
    env.NODE_ENV === "production"
      ? "ENCRYPTION_KEY is not set. It is required in production to protect stored review-source credentials (generate one with: openssl rand -hex 32)."
      : "Set ENCRYPTION_KEY (or BETTER_AUTH_SECRET in development) to store review-source credentials."
  );
}

function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(encryptionSecret()).digest();
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  [key: string]: unknown;
}

export function isEncryptedData(obj: unknown): obj is EncryptedData {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "encrypted" in obj &&
    "iv" in obj &&
    "tag" in obj &&
    typeof (obj as any).encrypted === "string" &&
    typeof (obj as any).iv === "string" &&
    typeof (obj as any).tag === "string"
  );
}

/**
 * Encrypts a credentials object into AES-256-GCM ciphertext with IV and auth tag.
 */
export function encryptCredentials(data: Record<string, unknown>): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(data);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag,
  };
}

/**
 * Decrypts an EncryptedData object back into credentials.
 * If data is already a plain object (not encrypted format), returns it as-is.
 */
export function decryptCredentials(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    return {};
  }

  if (!isEncryptedData(data)) {
    return data as Record<string, unknown>;
  }

  // A missing key is a configuration error and must surface, not look like "no credentials"
  const key = getEncryptionKey();
  try {
    const iv = Buffer.from(data.iv, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(Buffer.from(data.tag, "hex"));

    let decrypted = decipher.update(data.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    log.error("Failed to decrypt credentials:", error);
    return {};
  }
}
