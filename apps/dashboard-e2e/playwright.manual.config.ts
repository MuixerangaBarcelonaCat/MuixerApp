import { defineConfig, devices } from '@playwright/test';

/**
 * Screenshots for the user manual (docs/manual/img/). Not a test suite: one "test" per app walks
 * MANUAL_SHOTS and writes PNGs. Writes to the API are blocked, so it never changes data.
 *
 * Prerequisite: Postgres + API + dashboard (:4200) + PWA (:4300) running.
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... [E2E_MEMBER_EMAIL=... E2E_MEMBER_PASSWORD=...] [SHOTS=03,04] \
 *     pnpm run docs:manual-shots
 */
const pwa = {
  ...devices['Desktop Chrome'],
  baseURL: process.env['PWA_URL'] || 'http://localhost:4300',
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: './src/manual',
  outputDir: '../../dist/.playwright/manual-shots/test-output',
  timeout: 600_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    colorScheme: 'light',
    screenshot: 'off',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'dashboard',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env['BASE_URL'] || 'http://localhost:4200',
        viewport: { width: 1280, height: 800 },
      },
    },
    { name: 'pwa', use: pwa },
    { name: 'pwa-member', use: pwa },
  ],
});
