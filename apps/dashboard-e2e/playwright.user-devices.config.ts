import { defineConfig, devices } from '@playwright/test';

/**
 * «Dispositius i sessions» (API + dashboard). Writes to the dev DB and cleans up after itself.
 * Prerequisite: Postgres + API + dashboard running. Usage: see src/user-devices/user-devices.spec.ts.
 */
export default defineConfig({
  testDir: './src/user-devices',
  outputDir: '../../dist/.playwright/user-devices/test-output',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env['BASE_URL'] || 'http://localhost:4200',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
  },
});
