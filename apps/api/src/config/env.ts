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

// Accept the conventional AWS names while keeping S3_* as the provider-neutral contract used by
// the application. Explicit S3_* values always win for R2, MinIO, and other compatible providers.
const copyNonEmptyAlias = (target: string, source: string): void => {
  if (
    (process.env[target] === undefined || process.env[target] === '') &&
    process.env[source] !== undefined &&
    process.env[source] !== ''
  ) {
    process.env[target] = process.env[source];
  }
};

copyNonEmptyAlias('S3_REGION', 'AWS_REGION');
copyNonEmptyAlias('S3_BUCKET', 'AWS_S3_BUCKET');
copyNonEmptyAlias('S3_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID');
copyNonEmptyAlias('S3_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY');
copyNonEmptyAlias('STRIPE_PUBLIC_KEY', 'STRIPE_PUBLISHABLE_KEY');

// Empty optional values in local .env files should receive schema defaults instead of failing app
// startup. Production readiness checks below still reject those local defaults when AI is enabled.
for (const key of ['S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
  if (process.env[key] === '') delete process.env[key];
}

// Container platforms expose internal services as host:port pairs. Derive full URLs without
// hardcoding provider-specific hostnames in source control.
if (process.env.AI_SERVICE_URL === undefined && process.env.AI_SERVICE_HOSTPORT !== undefined) {
  process.env.AI_SERVICE_URL = `http://${process.env.AI_SERVICE_HOSTPORT}`;
}

const booleanFromEnvironment = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}, z.boolean());

export const isCompleteCloudinaryUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value.trim());
    return (
      parsed.protocol.toLowerCase() === 'cloudinary:' &&
      parsed.username.length > 0 &&
      parsed.password.length > 0 &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
};

const EnvSchema = z
  .object({
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
    CLOUDINARY_URL: z.string().trim().default(''),
    CLOUDINARY_FOLDER: z.string().trim().min(1).default('cutg'),
    AI_PROVIDER: z.enum(['mock', 'fal']).default('mock'),
    AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
    AI_INTERNAL_SECRET: z.string().min(32).default('cutg-local-ai-secret-change-before-production'),
    AI_GENERATION_MODEL: z.string().min(1).default('openai/gpt-image-2/edit'),
    AI_SCAN_RETENTION_HOURS: z.coerce.number().int().min(1).max(168).default(24),
    AI_GENERATION_DAILY_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
    AI_MONTHLY_BUDGET_CENTS: z.coerce.number().nonnegative().default(0),
    EMAIL_PROVIDER: z.enum(['log', 'sendgrid']).default('log'),
    SENDGRID_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().email().default('noreply@example.com'),
    WEB_APP_URL: z.string().url().default('http://localhost:3000'),
    MOBILE_APP_URL: z.string().default('cutg://'),
    ENABLE_ANALYTICS: booleanFromEnvironment.default(false),
    ENABLE_AI_FEATURES: booleanFromEnvironment.default(false),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== 'production') return;

    const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);
    const rejectLoopbackUrl = (field: 'DATABASE_URL' | 'AI_SERVICE_URL' | 'S3_ENDPOINT'): void => {
      if (loopbackHosts.has(new URL(value[field]).hostname)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} cannot point to localhost in production.`,
        });
      }
    };

    rejectLoopbackUrl('DATABASE_URL');
    if (value.JWT_SECRET === 'your_jwt_secret_here_change_in_production') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be replaced in production.',
      });
    }
    if (new URL(value.WEB_APP_URL).protocol !== 'https:') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WEB_APP_URL'],
        message: 'WEB_APP_URL must use HTTPS in production.',
      });
    }
    if (value.CLOUDINARY_URL.length > 0 && !isCompleteCloudinaryUrl(value.CLOUDINARY_URL)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CLOUDINARY_URL'],
        message:
          'CLOUDINARY_URL must be the complete cloudinary://API_KEY:API_SECRET@CLOUD_NAME value.',
      });
    }
    if (value.EMAIL_PROVIDER === 'sendgrid') {
      if (!value.SENDGRID_API_KEY.startsWith('SG.')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SENDGRID_API_KEY'],
          message: 'A SendGrid API key is required when EMAIL_PROVIDER=sendgrid.',
        });
      }
      if (value.EMAIL_FROM === 'noreply@example.com') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_FROM'],
          message: 'EMAIL_FROM must be a verified sender when EMAIL_PROVIDER=sendgrid.',
        });
      }
    }
    if (value.ENABLE_AI_FEATURES) {
      rejectLoopbackUrl('AI_SERVICE_URL');
      rejectLoopbackUrl('S3_ENDPOINT');
      if (value.AI_INTERNAL_SECRET === 'cutg-local-ai-secret-change-before-production') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AI_INTERNAL_SECRET'],
          message: 'AI_INTERNAL_SECRET must be replaced in production.',
        });
      }
      if (
        value.S3_ACCESS_KEY_ID === 'cutg-local' ||
        value.S3_SECRET_ACCESS_KEY === 'cutg-local-secret'
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['S3_ACCESS_KEY_ID'],
          message: 'Production object-storage credentials must replace the local defaults.',
        });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

// The Cloudinary SDK eagerly parses CLOUDINARY_URL when it is imported. Keep the original value in
// our typed environment so development can report a useful warning, but remove an incomplete value
// from the process environment before the optional SDK is loaded. Production has already rejected
// the same value above.
if (!isCompleteCloudinaryUrl(env.CLOUDINARY_URL)) {
  delete process.env.CLOUDINARY_URL;
}
