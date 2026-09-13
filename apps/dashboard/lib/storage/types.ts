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

export interface StorageAdapter {
  /**
   * Upload a file to storage.
   * @returns The public URL of the uploaded file
   */
  upload(file: Buffer, key: string, options?: UploadOptions): Promise<string>;

  /** Delete a file from storage */
  delete(key: string): Promise<void>;

  /**
   * Generate a signed/temporary URL for accessing a file.
   * @param expiresIn - Expiry time in seconds (default: 3600)
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
