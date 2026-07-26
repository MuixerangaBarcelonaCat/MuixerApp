import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { RESULTS_DIR } from '../audit/paths';

/**
 * PWA-specific behaviour audit: manifest validity, service-worker registration
 * and offline resilience. Runs against a PRODUCTION build served statically
 * (see playwright.pwa-behavior.config.ts) because the Angular service worker is
 * disabled in `nx serve` (`enabled: !isDevMode()`).
 */

interface PwaBehavior {
  manifest: {
    reachable: boolean;
    name?: string;
    shortName?: string;
    display?: string;
    startUrl?: string;
    themeColor?: string;
    backgroundColor?: string;
    iconCount?: number;
    hasMaskableIcon?: boolean;
  };
  serviceWorker: {
    supported: boolean;
    ngswWorkerReachable: boolean;
    registered: boolean;
    controlling: boolean;
  };
  offline: {
    testable: boolean;
    appShellLoadedOffline: boolean;
  };
  consoleErrors: string[];
}

test('pwa behaviour: manifest, service worker, offline', async ({ page, context }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  const result: PwaBehavior = {
    manifest: { reachable: false },
    serviceWorker: { supported: false, ngswWorkerReachable: false, registered: false, controlling: false },
    offline: { testable: false, appShellLoadedOffline: false },
    consoleErrors: [],
  };

  await page.goto('/', { waitUntil: 'networkidle' }).catch(() => {});

  // --- Manifest ---
  const manifest = await page
    .evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      const href = link?.href || '/manifest.webmanifest';
      const res = await fetch(href);
      if (!res.ok) return null;
      return res.json();
    })
    .catch(() => null);

  if (manifest) {
    const icons = (manifest.icons || []) as { purpose?: string }[];
    result.manifest = {
      reachable: true,
      name: manifest.name,
      shortName: manifest.short_name,
      display: manifest.display,
      startUrl: manifest.start_url,
      themeColor: manifest.theme_color,
      backgroundColor: manifest.background_color,
      iconCount: icons.length,
      hasMaskableIcon: icons.some((i) => (i.purpose || '').includes('maskable')),
    };
  }

  // --- Service worker registration (registerWhenStable:30000 → allow time) ---
  result.serviceWorker.supported = await page.evaluate(() => 'serviceWorker' in navigator);
  result.serviceWorker.ngswWorkerReachable = await page
    .evaluate(async () => (await fetch('/ngsw-worker.js')).ok)
    .catch(() => false);

  if (result.serviceWorker.supported) {
    const ready = await page
      .evaluate(
        () =>
          Promise.race([
            navigator.serviceWorker.ready.then(() => true),
            new Promise((r) => setTimeout(() => r(false), 40000)),
          ]),
      )
      .catch(() => false);
    result.serviceWorker.registered = await page
      .evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length > 0)
      .catch(() => false);
    result.serviceWorker.controlling = await page
      .evaluate(() => !!navigator.serviceWorker.controller)
      .catch(() => false);

    // --- Offline resilience (only meaningful if a SW is active) ---
    if (ready || result.serviceWorker.controlling) {
      result.offline.testable = true;
      // Give ngsw time to prefetch the app assets, and warm lazy chunks.
      await page.waitForTimeout(4000);
      await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(2000);
      await context.setOffline(true);
      const loaded = await page
        .reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      const hasRoot = await page
        .locator('app-root, #app-shell, body *')
        .first()
        .isVisible()
        .catch(() => false);
      result.offline.appShellLoadedOffline = loaded && hasRoot;
      await context.setOffline(false);
    }
  }

  result.consoleErrors = consoleErrors.filter((e) => !/manifest|icon/i.test(e)).slice(0, 30);

  const dir = path.join(RESULTS_DIR, 'pwa-behavior');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));

  expect.soft(result.manifest.reachable, 'manifest reachable').toBeTruthy();
  expect.soft(result.serviceWorker.registered, 'service worker registered').toBeTruthy();
});
