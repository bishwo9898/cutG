import {
  DeleteObjectCommand,
  GetObjectCommand,
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

export const createPresignedUploadUrl = async (key: string, contentType: string): Promise<string> =>
  getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: env.S3_PRESIGNED_TTL_SECONDS },
  );

export const createPresignedDownloadUrl = async (key: string): Promise<string> => {
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

  if (size !== expectedSize || size > 3_000_000 || contentType !== expectedContentType) {
    throw new Error('Uploaded object metadata did not match the signed capture request.');
  }
};

export const deleteStoredObject = async (key: string): Promise<void> => {
  await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
};
