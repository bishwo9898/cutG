import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      AI_PROVIDER: 'mock',
      ENABLE_AI_FEATURES: 'true',
    },
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    setupFiles: ['./src/test/clerkAuthMock.ts'],
    testTimeout: 15_000,
  },
});
