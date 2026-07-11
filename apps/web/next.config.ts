import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Next runs from apps/web, so explicitly load the monorepo's shared environment files.
// Loading local first gives it precedence without overwriting app-specific variables Next loaded.
loadEnv({ path: resolve(repositoryRoot, '.env.local') });
loadEnv({ path: resolve(repositoryRoot, '.env') });

const nextConfig: NextConfig = {
  transpilePackages: ['@barber-saas/api-client', '@barber-saas/shared-types'],
};

export default nextConfig;
