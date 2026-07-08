import type { Knex } from 'knex';

import { env } from './config/env';

const config: Knex.Config = {
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: {
    min: env.DATABASE_POOL_MIN,
    max: env.DATABASE_POOL_MAX,
  },
  migrations: {
    directory: './db/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './db/seeds',
    extension: 'ts',
  },
};

export default config;
