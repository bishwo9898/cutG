import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import { DEFAULT_HOST, DEFAULT_PORT } from './constants';

const repositoryRoot = resolve(__dirname, '../../../..');
loadEnv({ path: resolve(repositoryRoot, '.env.local') });
loadEnv({ path: resolve(repositoryRoot, '.env') });
loadEnv();

// Existing cutG environments predate REDIS_URL and only declare the Docker host port.
// Derive the local URL so enabling queue-backed features does not require an env migration.
process.env.REDIS_URL ??= `redis://localhost:${process.env.REDIS_HOST_PORT ?? '6380'}`;

const booleanFromEnvironment = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  HOST: z.string().min(1).default(DEFAULT_HOST),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://barber_user:barber_password@localhost:5432/barber_saas'),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().url().default('redis://localhost:6380'),
  JWT_SECRET: z.string().min(32).default('your_jwt_secret_here_change_in_production'),
  JWT_EXPIRY: z.string().min(1).default('24h'),
  JWT_REFRESH_EXPIRY: z.string().min(1).default('30d'),
  STRIPE_SECRET_KEY: z.string().min(1).default('sk_test_...'),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).default('pk_test_...'),
  STRIPE_PUBLIC_KEY: z.string().min(1).default('pk_test_...'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).default('whsec_...'),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  STRIPE_PRICE_BASIC_MONTHLY: z.string().min(1).default('price_basic_monthly_test'),
  STRIPE_PRICE_BASIC_ANNUAL: z.string().min(1).default('price_basic_annual_test'),
  STRIPE_PRICE_PREMIUM_MONTHLY: z.string().min(1).default('price_premium_monthly_test'),
  STRIPE_PRICE_PREMIUM_ANNUAL: z.string().min(1).default('price_premium_annual_test'),
  STRIPE_SUBSCRIPTION_SUCCESS_URL: z.string().min(1).default('cutg://subscription/success'),
  STRIPE_SUBSCRIPTION_CANCEL_URL: z.string().min(1).default('cutg://subscription/cancelled'),
  GOOGLE_MAPS_API_KEY: z.string().default(''),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(3).default('cutg-ai-local'),
  S3_ACCESS_KEY_ID: z.string().min(1).default('cutg-local'),
  S3_SECRET_ACCESS_KEY: z.string().min(8).default('cutg-local-secret'),
  S3_FORCE_PATH_STYLE: booleanFromEnvironment.default(true),
  S3_PRESIGNED_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  AI_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_IMAGE_MODEL: z.string().min(1).default('gemini-3.1-flash-image'),
  GEMINI_SUGGESTION_MODEL: z.string().min(1).default('gemini-3.1-flash-lite'),
  AI_SCAN_RETENTION_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  AI_GENERATION_DAILY_LIMIT: z.coerce.number().int().min(1).max(100).default(3),
  AI_MONTHLY_BUDGET_CENTS: z.coerce.number().nonnegative().default(0),
  AI_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  MOBILE_APP_URL: z.string().default('cutg://'),
  ENABLE_ANALYTICS: booleanFromEnvironment.default(false),
  ENABLE_AI_FEATURES: booleanFromEnvironment.default(false),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
