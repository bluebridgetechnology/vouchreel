import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter, StoredFile, UploadOptions } from "./types";

/**
 * S3-compatible storage adapter.
 * Works with AWS S3, Cloudflare R2, MinIO, and any S3-compatible provider.
 * Set STORAGE_ENDPOINT for non-AWS providers (e.g., R2).
 */
export class S3Adapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    const region = process.env.STORAGE_REGION || "us-east-1";
    const endpoint = process.env.STORAGE_ENDPOINT;
    const bucket = process.env.STORAGE_BUCKET;

    if (!bucket) {
      throw new Error("STORAGE_BUCKET environment variable is required for S3 storage");
    }
    if (!process.env.STORAGE_KEY || !process.env.STORAGE_SECRET) {
      throw new Error(
        "STORAGE_KEY and STORAGE_SECRET environment variables are required for S3 storage"
      );
    }

    this.bucket = bucket;

    // For R2, the public URL uses the R2 public bucket domain
    // For S3, it uses the standard S3 URL format
    this.publicUrl = endpoint
      ? `${endpoint}/${bucket}`
      : `https://${bucket}.s3.${region}.amazonaws.com`;

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: process.env.STORAGE_KEY,
        secretAccessKey: process.env.STORAGE_SECRET,
      },
      // Required for R2 and some S3-compatible providers
      forcePathStyle: !!endpoint,
    });
  }

  async upload(
    file: Buffer,
    key: string,
    options?: UploadOptions
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: options?.contentType,
        ACL: options?.public ? "public-read" : undefined,
        Metadata: options?.metadata,
      })
    );

    return `${this.publicUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async *list(prefix: string): AsyncIterable<StoredFile> {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token })
      );
      for (const object of page.Contents ?? []) {
        if (object.Key) yield { key: object.Key, size: object.Size ?? 0, lastModified: object.LastModified ?? new Date(0) };
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return awsGetSignedUrl(this.client, command, { expiresIn });
  }
}
