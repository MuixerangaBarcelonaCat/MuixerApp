import { Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';

/** Opens the user menu (CSS focus dropdown in the header). */
async function openUserMenu(page: Page): Promise<void> {
  await page.locator('app-user-chip [role="button"]').first().click();
  await page.locator('app-user-chip ul.dropdown-content').waitFor({ state: 'visible' });
}

/** The logged-in user's e-mail, shown at the top of the user menu. */
const USER_MENU_MASK = ['app-user-chip li.menu-title span.truncate'];

/** S01 · 00-benvinguda + 01-primers-passos. lib-card is display:contents, hence the `> *`. */
export const s01: ManualShot[] = [
  // ── 00-benvinguda ────────────────────────────────────────────────
  {
    file: '00-config-manual.png',
    app: 'dashboard',
    path: '/config',
    ready: 'lib-card[title="Manual"] > *',
    highlight: 'lib-card[title="Manual"] > *',
  },
  {
    file: '00-manual-visor.png',
    app: 'dashboard',
    path: '/config/manual/00-benvinguda',
    ready: '.prose h1',
    settle: 500,
  },

  // ── 01-primers-passos ────────────────────────────────────────────
  {
    file: '01-inici.png',
    app: 'dashboard',
    path: '/home',
    ready: 'lib-card[title="Pròxim assaig"] > *',
    settle: 800, // let the two event cards leave the skeleton state
  },
  {
    file: '01-navegacio.png',
    app: 'dashboard',
    path: '/home',
    ready: 'app-tab-nav a[href="/home"]',
    clip: 'app-tab-nav > div:first-child', // desktop tab strip
  },
  {
    file: '01-menu-usuari.png',
    app: 'dashboard',
    path: '/home',
    ready: 'app-user-chip [role="button"]',
    prepare: openUserMenu,
    highlight: 'app-user-chip ul.dropdown-content',
    mask: USER_MENU_MASK,
  },
  {
    file: '01-aparenca.png',
    app: 'dashboard',
    path: '/home',
    ready: 'app-user-chip [role="button"]',
    prepare: openUserMenu,
    highlight: '[data-testid="appearance-item"]',
    mask: USER_MENU_MASK,
    clip: 'app-user-chip ul.dropdown-content',
  },
  {
    file: '01-sobre-app.png',
    app: 'dashboard',
    path: '/home',
    ready: 'app-user-chip [role="button"]',
    prepare: async (page) => {
      await openUserMenu(page);
      await page.getByTestId('about-item').click();
      await page.locator('dialog[open] [data-testid="privacy-policy-viewer"]').waitFor();
    },
    settle: 800, // the privacy policy markdown is @defer-loaded
  },
  // Last on purpose: /login is reached client-side with the session still in memory
  // (the dashboard login route has no "already logged in" guard).
  {
    file: '01-login.png',
    app: 'dashboard',
    path: '/login',
    ready: 'form button[type="submit"]',
  },
];
