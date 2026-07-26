import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

/**
 * Touch-gesture audit of the Pinyes canvas. Touch-enabled profiles only.
 *
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... \
 *     npx playwright test -c apps/dashboard-e2e/playwright.gestures.config.ts
 */
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

export default defineConfig({
  testDir: './src/audit-gestures',
  outputDir: '../../dist/.playwright/gestures/test-output',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-gestures', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'off' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
    {
      name: 'tablet-portrait',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true },
    },
    {
      name: 'tablet-landscape',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command: 'npx nx run dashboard:serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: workspaceRoot,
  },
});
