import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 15_000,
  },
});
