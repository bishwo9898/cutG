import { resolve } from 'node:path';

import dotenv from 'dotenv';
import { z } from 'zod';

import { DEFAULT_HOST, DEFAULT_PORT } from './constants';

dotenv.config({ path: resolve(__dirname, '../../../..', '.env') });
dotenv.config();

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
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  MOBILE_APP_URL: z.string().default('cutg://'),
  ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  ENABLE_AI_FEATURES: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
