import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@barber-saas/api-client', '@barber-saas/shared-types'],
};

export default nextConfig;
