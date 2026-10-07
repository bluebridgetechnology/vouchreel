/**
 * Pluggable storage adapter interface.
 * Implementations exist for S3-compatible (AWS S3, Cloudflare R2)
 * and Bunny.net storage. Provider is selected via STORAGE_PROVIDER env var.
 */

export interface UploadOptions {
  /** MIME content type (e.g., "image/jpeg", "video/mp4") */
  contentType?: string;
  /** Whether the uploaded file should be publicly accessible */
  public?: boolean;
  /** Custom metadata to attach to the object */
  metadata?: Record<string, string>;
}

/** A stored file as listed by the provider. */
export interface StoredFile {
  key: string;
  size: number;
  lastModified: Date;
}

/** A form the browser can POST a file to directly, without the file passing through our server. */
export interface PresignedUpload {
  url: string;
  /** Form fields to send before the file, exactly as given. */
  fields: Record<string, string>;
  /** The key the file will have. */
  key: string;
  expiresInSeconds: number;
}

export interface StorageAdapter {
  /**
   * Upload a file to storage.
   * @returns The public URL of the uploaded file
   */
  upload(file: Buffer, key: string, options?: UploadOptions): Promise<string>;

  /** Delete a file from storage. Deleting a file that does not exist is not an error. */
  delete(key: string): Promise<void>;

  /** Every file whose key starts with `prefix`, however many there are. Used to find files nothing refers to any more. */
  list(prefix: string): AsyncIterable<StoredFile>;

  /**
   * Generate a signed/temporary URL for accessing a file.
   * @param expiresIn - Expiry time in seconds (default: 3600)
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Direct-to-storage uploads (S3 and R2 only; others leave these out and uploads go through the server).
   * A presigned POST can enforce the size range and content type, which a presigned PUT cannot.
   */
  createPresignedUpload?(key: string, options: { contentType: string; maxBytes: number; expiresInSeconds?: number }): Promise<PresignedUpload>;

  /** Size and type of a stored object, or null when it does not exist. */
  head?(key: string): Promise<{ size: number; contentType?: string } | null>;

  /** `length` bytes from the start of a stored object (for checking what a file really is). */
  readStart?(key: string, length: number): Promise<Uint8Array>;

  /** The public URL a stored key is served at. */
  publicUrl?(key: string): string;
}
