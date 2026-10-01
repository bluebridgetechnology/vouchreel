import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    "vouchreel-secret-fallback-key-32b-length-secure";
  return crypto.createHash("sha256").update(secret).digest();
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

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(data.iv, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(Buffer.from(data.tag, "hex"));

    let decrypted = decipher.update(data.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Failed to decrypt credentials:", error);
    return {};
  }
}
