import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

/**
 * PWA behaviour audit (manifest / service worker / offline). Serves a PRODUCTION
 * build of the PWA on :4310 (the Angular SW is disabled in `nx serve`), built +
 * served by the `pwa:serve-static` target.
 *
 * Usage:
 *   npx playwright test -c apps/dashboard-e2e/playwright.pwa-behavior.config.ts
 */
const baseURL = process.env['PWA_PROD_URL'] || 'http://localhost:4310';

export default defineConfig({
  testDir: './src/audit-pwa-behavior',
  outputDir: '../../dist/.playwright/pwa-behavior/test-output',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-pwa-behavior', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 5'] } }],
  webServer: {
    command: 'npx nx run pwa:serve-static --port=4310',
    url: 'http://localhost:4310',
    reuseExistingServer: true,
    timeout: 240_000, // production build can be slow the first time
    cwd: workspaceRoot,
  },
});
