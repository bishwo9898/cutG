import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

const repositoryRoot = resolve(__dirname, '../../..');
loadEnv({ path: resolve(repositoryRoot, '.env.local') });
loadEnv({ path: resolve(repositoryRoot, '.env') });

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.trim() === '') throw new Error(`${name} is required.`);
  return value;
};

const integer = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: required(
    'DATABASE_URL',
    'postgresql://barber_user:barber_password@localhost:55433/barber_saas',
  ),
  redisUrl: required('REDIS_URL', 'redis://localhost:6380'),
  s3Endpoint: required('S3_ENDPOINT', 'http://localhost:9000'),
  s3Region: required('S3_REGION', 'us-east-1'),
  s3Bucket: required('S3_BUCKET', 'cutg-ai-local'),
  s3AccessKeyId: required('S3_ACCESS_KEY_ID', 'cutg-local'),
  s3SecretAccessKey: required('S3_SECRET_ACCESS_KEY', 'cutg-local-secret'),
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true',
  provider: (process.env.AI_PROVIDER ?? 'mock') as 'mock' | 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiImageModel: process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image',
  geminiSuggestionModel: process.env.GEMINI_SUGGESTION_MODEL ?? 'gemini-3.1-flash-lite',
  concurrency: integer('AI_WORKER_CONCURRENCY', 2),
  retentionHours: integer('AI_SCAN_RETENTION_HOURS', 24),
};

if (config.provider === 'gemini' && config.geminiApiKey.trim() === '') {
  throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini.');
}

export const redisConnection = (): {
  host: string;
  port: number;
  password?: string;
  db?: number;
} => {
  const url = new URL(config.redisUrl);
  const database = Number(url.pathname.replace('/', '') || 0);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password === '' ? {} : { password: decodeURIComponent(url.password) }),
    ...(database === 0 ? {} : { db: database }),
  };
};
