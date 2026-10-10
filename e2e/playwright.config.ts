import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * Runs the real API (in-memory MongoDB, dev instant sign-in) which also serves the production
 * build of the Angular app, exactly like on Render. Build the client first:
 *   npm run build --prefix ../client
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Phone-sized: the app is mobile-first.
    ...devices['Pixel 7'],
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npx tsx src/index.ts',
    cwd: '../server',
    url: `${baseURL}/api/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'development',
      PORT: String(PORT),
      MONGODB_URI: '',
      DEV_INSTANT_JOIN: 'true',
      CLIENT_URL: baseURL,
      SEED_DEMO: 'false',
      LOG_LEVEL: 'warn',
    },
  },
});
