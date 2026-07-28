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
  // Quick Tunnels proxy the development client through a temporary hostname. Next.js protects
  // internal dev resources (including the HMR WebSocket) against unknown origins by default, so
  // allow Cloudflare's ephemeral hostnames only during the explicit two-person field-test mode.
  ...(process.env.NEXT_PUBLIC_FIELD_TEST_MODE === 'true'
    ? { allowedDevOrigins: ['*.trycloudflare.com'] }
    : {}),
  transpilePackages: ['@barber-saas/api-client', '@barber-saas/shared-types'],
};

export default nextConfig;
