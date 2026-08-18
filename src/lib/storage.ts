import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage adapter for Attachments (roadmap item #1 in CLAUDE.md).
 * Speaks the S3 protocol, which covers AWS S3 directly and, via
 * STORAGE_ENDPOINT, any S3-compatible gateway (MinIO, Cloudflare R2, GCS's
 * S3-compatible interface). Azure Blob does not speak S3 natively — a
 * tenant that needs it would get its own adapter behind this same
 * getUploadUrl/getDownloadUrl/deleteObject interface, not a rewrite of the
 * routes that call it.
 */

function isStorageConfigured(): boolean {
  return Boolean(process.env.STORAGE_BUCKET && process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY);
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: process.env.STORAGE_REGION || "auto",
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    // Required for MinIO/R2-style endpoints; harmless against real AWS S3.
    forcePathStyle: Boolean(process.env.STORAGE_ENDPOINT),
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/** Presigned PUT URL the browser uploads the file bytes to directly — the API route never streams the file through itself. */
async function getUploadUrl(storageKey: string, contentType: string): Promise<string> {
  const bucket = process.env.STORAGE_BUCKET!;
  const command = new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: contentType });
  return getSignedUrl(getClient(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

/** Presigned GET URL for downloading an attachment, forcing the original filename via Content-Disposition. */
async function getDownloadUrl(storageKey: string, fileName: string): Promise<string> {
  const bucket = process.env.STORAGE_BUCKET!;
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
  });
  return getSignedUrl(getClient(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

async function deleteObject(storageKey: string): Promise<void> {
  const bucket = process.env.STORAGE_BUCKET!;
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
}

export const storage = { isStorageConfigured, getUploadUrl, getDownloadUrl, deleteObject };
