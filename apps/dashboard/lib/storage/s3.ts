import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { PresignedUpload, StorageAdapter, StoredFile, UploadOptions } from "./types";

/**
 * S3-compatible storage adapter.
 * Works with AWS S3, Cloudflare R2, MinIO, and any S3-compatible provider.
 * Set STORAGE_ENDPOINT for non-AWS providers (e.g., R2).
 */
export class S3Adapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private publicBase: string;

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
    this.publicBase = endpoint
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

    return `${this.publicBase}/${key}`;
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  async createPresignedUpload(key: string, options: { contentType: string; maxBytes: number; expiresInSeconds?: number }): Promise<PresignedUpload> {
    const expiresInSeconds = options.expiresInSeconds ?? 15 * 60;
    const post = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresInSeconds,
      Fields: { "Content-Type": options.contentType, acl: "public-read" },
      Conditions: [
        ["content-length-range", 1, options.maxBytes],
        ["eq", "$Content-Type", options.contentType],
        ["eq", "$acl", "public-read"],
      ],
    });
    return { url: post.url, fields: post.fields, key, expiresInSeconds };
  }

  async head(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: out.ContentLength ?? 0, contentType: out.ContentType };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number }; name?: string }).$metadata?.httpStatusCode;
      if (status === 404 || (error as { name?: string }).name === "NotFound") return null;
      throw error;
    }
  }

  async readStart(key: string, length: number): Promise<Uint8Array> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${Math.max(0, length - 1)}` }));
    return out.Body ? await out.Body.transformToByteArray() : new Uint8Array();
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
