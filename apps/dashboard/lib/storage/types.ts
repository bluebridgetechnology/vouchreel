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
}
