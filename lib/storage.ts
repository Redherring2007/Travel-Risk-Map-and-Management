import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function isStorageConfigured() {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_REGION && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export function getStorageBucket() {
  return process.env.S3_BUCKET || '';
}

function client() {
  if (!isStorageConfigured()) {
    throw new Error('S3-compatible storage is not configured. Set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.');
  }
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!
    }
  });
}

export async function createSignedUploadUrl(input: { key: string; contentType: string; expiresIn?: number }) {
  const command = new PutObjectCommand({ Bucket: getStorageBucket(), Key: input.key, ContentType: input.contentType });
  return getSignedUrl(client(), command, { expiresIn: input.expiresIn ?? 300 });
}

export async function createSignedDownloadUrl(input: { key: string; expiresIn?: number }) {
  const command = new GetObjectCommand({ Bucket: getStorageBucket(), Key: input.key });
  return getSignedUrl(client(), command, { expiresIn: input.expiresIn ?? 300 });
}
