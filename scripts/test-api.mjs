import { spawnSync } from 'node:child_process';

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://barber_test:barber_test_password@localhost:55434/barber_saas_test';

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  DATABASE_POOL_MIN: '0',
  LOG_LEVEL: 'error',
  ENABLE_AI_FEATURES: 'true',
  AI_PROVIDER: 'mock',
};

const run = (args) => {
  const result = spawnSync('pnpm', args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run([
  '--filter',
  '@barber-saas/api',
  'exec',
  'knex',
  '--knexfile',
  'src/knexfile.ts',
  'migrate:latest',
]);
run(['--filter', '@barber-saas/api', 'exec', 'vitest', 'run']);
