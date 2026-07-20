import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

/**
 * Dedicated config for the responsive / usability audit.
 *
 * Runs the audit spec across Desktop, Tablet (portrait + landscape) and Mobile.
 * Each test logs in fresh via the UI (the refresh token is single-use/rotating,
 * so a shared storageState would go stale after the first test).
 *
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... \
 *     npx playwright test -c apps/dashboard-e2e/playwright.audit.config.ts
 *
 * Report:  npx playwright show-report apps/dashboard-e2e/playwright-report-audit
 */
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

const auditProjects = [
  {
    name: 'desktop',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
  },
  {
    name: 'tablet-portrait',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 768, height: 1024 },
      hasTouch: true,
      isMobile: true,
    },
  },
  {
    name: 'tablet-landscape',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
      isMobile: true,
    },
  },
  {
    name: 'mobile',
    use: { ...devices['Pixel 5'] }, // 393×851, touch, mobile
  },
];

export default defineConfig({
  testDir: './src/audit',
  outputDir: '../../dist/.playwright/dashboard-audit/test-output',
  timeout: 180_000, // one test walks all routes for a device
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-audit', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'off', // we take our own full-page shots
  },
  projects: auditProjects,
  webServer: {
    command: 'npx nx run dashboard:serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: workspaceRoot,
  },
});
