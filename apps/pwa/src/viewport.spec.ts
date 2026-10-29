import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Guards the installed-app (standalone PWA) layout on iOS and Android. A browser test can't
// reproduce a notch or the home indicator, so these check the source for the patterns that hid
// actions behind them before.
const root = resolve(process.cwd(), 'apps/pwa');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const appSources = (readdirSync(resolve(root, 'src/app'), { recursive: true }) as string[])
  .filter((f) => /\.(html|ts)$/.test(f) && !f.endsWith('.spec.ts'))
  .map((f) => ({ file: f, text: read(`src/app/${f}`) }));

describe('installed PWA viewport', () => {
  it('sizes screens with dynamic viewport units, never 100vh', () => {
    // 100vh is taller than the visible area under mobile browser chrome, so bottom actions fall
    // off-screen; dvh tracks what is actually visible.
    const offenders = appSources
      .filter(({ text }) => /\b(min-h-screen|h-screen|max-h-screen)\b|100vh/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('keeps every bottom-anchored fixed element clear of the home indicator', () => {
    // A fixed element pinned with a plain bottom-N lands under the iPhone home indicator.
    const offenders = appSources
      .filter(({ text }) => /\bfixed\b[^"]*\bbottom-(?!0\b|safe-|above-tab-bar\b)/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('lets the page extend under the notch so env(safe-area-inset-*) is non-zero', () => {
    expect(read('src/index.html')).toMatch(/name="viewport"[^>]*viewport-fit=cover/);
  });

  it('keeps the manifest installable and in sync with index.html', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    const themeMeta = read('src/index.html').match(/name="theme-color" content="([^"]+)"/)?.[1];

    expect(manifest.id).toBeDefined();
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe(themeMeta);
    expect(manifest.icons).toContainEqual(expect.objectContaining({ sizes: '192x192' }));
    expect(manifest.icons).toContainEqual(expect.objectContaining({ sizes: '512x512' }));
    expect(manifest.icons).toContainEqual(expect.objectContaining({ purpose: 'maskable' }));
  });
});
