import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../../config/env';

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

let storageReadiness: Promise<void> | undefined;

const statusCode = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('$metadata' in error)) return undefined;
  const metadata = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata;
  return typeof metadata?.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined;
};

const checkStorage = async (): Promise<void> => {
  try {
    await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch (error) {
    if (env.NODE_ENV === 'production' || statusCode(error) !== 404) throw error;

    // Local MinIO data can outlive configuration changes. Recreate the configured private bucket
    // on demand so a legacy AWS_S3_BUCKET value cannot produce a valid URL for a missing bucket.
    await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
};

export const ensurePrivateStorageReady = async (): Promise<void> => {
  storageReadiness ??= checkStorage();
  try {
    await storageReadiness;
  } catch (error) {
    storageReadiness = undefined;
    throw error;
  }
};

export const createPresignedUploadUrl = async (
  key: string,
  contentType: string,
): Promise<string> => {
  await ensurePrivateStorageReady();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: env.S3_PRESIGNED_TTL_SECONDS },
  );
};

export const createPresignedDownloadUrl = async (key: string): Promise<string> => {
  await ensurePrivateStorageReady();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: env.S3_PRESIGNED_TTL_SECONDS,
  });
};

export const verifyUploadedObject = async (
  key: string,
  expectedContentType: string,
  expectedSize: number,
): Promise<void> => {
  const result = await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const size = result.ContentLength ?? 0;
  const contentType = result.ContentType ?? '';

  if (size !== expectedSize || size > 4_000_000 || contentType !== expectedContentType) {
    throw new Error('Uploaded object metadata did not match the signed capture request.');
  }
};

export const copyRemoteImageToStorage = async (
  sourceUrl: string,
  destinationKey: string,
): Promise<{ contentType: string; sizeBytes: number }> => {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error('Generated image could not be downloaded.');
  const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('Generated asset was not a supported image.');
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0 || body.length > 12_000_000) {
    throw new Error('Generated image size was invalid.');
  }
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: destinationKey,
      Body: body,
      ContentType: contentType,
      Metadata: { private: 'true' },
    }),
  );
  return { contentType, sizeBytes: body.length };
};

export const deleteStoredObject = async (key: string): Promise<void> => {
  await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
};
