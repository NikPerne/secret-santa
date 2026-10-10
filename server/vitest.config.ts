import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: { NODE_ENV: 'test', DEV_INSTANT_JOIN: 'true', CLIENT_URL: 'http://localhost:4200' },
  },
});
