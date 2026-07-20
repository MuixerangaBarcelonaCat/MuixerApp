import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

/**
 * Responsive / usability audit for the PWA (apps/pwa), which is mobile-first.
 * Serves the PWA on :4300 and walks it on mobile + tablet + desktop.
 *
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... \
 *     npx playwright test -c apps/dashboard-e2e/playwright.pwa-audit.config.ts
 */
const baseURL = process.env['PWA_BASE_URL'] || 'http://localhost:4300';

const projects = [
  { name: 'mobile', use: { ...devices['Pixel 5'] } },
  {
    name: 'tablet-portrait',
    use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true },
  },
  {
    name: 'tablet-landscape',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true },
  },
  { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
];

export default defineConfig({
  testDir: './src/audit-pwa',
  outputDir: '../../dist/.playwright/pwa-audit/test-output',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-pwa-audit', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'off',
  },
  projects,
  webServer: {
    command: 'npx nx run pwa:serve',
    url: 'http://localhost:4300',
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: workspaceRoot,
  },
});
