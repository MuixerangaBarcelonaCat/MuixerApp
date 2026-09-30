import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

/**
 * Touch e2e of the segment workspace's assignment flow (tap → person modal, long press → move,
 * swap, cancel, no drag). Hermetic: the API is mocked in the browser (see `mock-api.ts`), so it
 * needs no credentials, no database and never touches dev data — only the dashboard dev server.
 *
 * Usage:
 *   pnpm e2e:assign-touch
 */
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

export default defineConfig({
  testDir: './src/assign-touch',
  outputDir: '../../dist/.playwright/assign-touch/test-output',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-assign-touch', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 5'] } },
    {
      name: 'tablet-portrait',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command: 'npx nx run dashboard:serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
    cwd: workspaceRoot,
  },
});
