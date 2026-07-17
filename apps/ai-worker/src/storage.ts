import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { config } from './config';

const storage = new S3Client({
  endpoint: config.s3Endpoint,
  region: config.s3Region,
  forcePathStyle: config.s3ForcePathStyle,
  credentials: {
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
  },
});

export const readObject = async (key: string): Promise<Buffer> => {
  const result = await storage.send(new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }));
  if (result.Body === undefined) throw new Error(`Stored capture ${key} was empty.`);
  return Buffer.from(await result.Body.transformToByteArray());
};

export const writeObject = async (
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> => {
  await storage.send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'private, max-age=0, no-store',
    }),
  );
};

export const deleteObject = async (key: string): Promise<void> => {
  await storage.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key }));
};
