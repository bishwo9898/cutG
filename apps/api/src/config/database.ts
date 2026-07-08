import { Pool } from 'pg';

import { logger } from '../utils/logger';

import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.DATABASE_POOL_MIN,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error: Error): void => {
  logger.error('Unexpected PostgreSQL pool error', error);
});

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};
