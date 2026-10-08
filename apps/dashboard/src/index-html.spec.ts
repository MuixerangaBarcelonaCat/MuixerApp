import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEME_NAMES, THEME_STORAGE_KEY } from '@muixer/ui';

// index.html can't import THEME_NAMES/THEME_STORAGE_KEY, so its pre-boot theme script carries
// copies — these run the real script to catch any drift.
const html = readFileSync(resolve(process.cwd(), 'apps/dashboard/src/index.html'), 'utf8');
const preBootScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';

function runPreBoot(stored: string | null): string | undefined {
  delete document.documentElement.dataset['theme'];
  localStorage.clear();
  if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);
  new Function(preBootScript)();
  return document.documentElement.dataset['theme'];
}

describe('index.html theme', () => {
  afterEach(() => {
    delete document.documentElement.dataset['theme'];
    localStorage.clear();
  });

  it('hardcodes no theme, so DaisyUI follows the system color scheme by default', () => {
    expect(html).not.toMatch(/data-theme=/);
    expect(runPreBoot(null)).toBeUndefined();
  });

  it('applies a stored explicit choice before the app boots', () => {
    expect(runPreBoot('dark')).toBe(THEME_NAMES.dark);
    expect(runPreBoot('light')).toBe(THEME_NAMES.light);
  });

  it('ignores an unknown stored value', () => {
    expect(runPreBoot('sepia')).toBeUndefined();
  });
});
