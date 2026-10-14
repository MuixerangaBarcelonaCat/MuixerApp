import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `<lucide-icon name="X">` resolves X against the curated set registered in `app.config.ts` — only
 * those icons are bundled. A name that isn't in the set throws at render time and takes the rest of
 * the view down with it, and no component spec catches it: `allLucideIconsProvider` registers every
 * icon there is, so the test double is more permissive than production.
 */
describe('registered Lucide icons', () => {
  const appRoot = join(process.cwd(), 'apps/dashboard/src');

  const registeredIcons = (): Set<string> => {
    const config = readFileSync(join(appRoot, 'app/app.config.ts'), 'utf8');
    const block = config.slice(config.indexOf('const icons = {'));
    return new Set(block.slice(0, block.indexOf('};')).match(/[A-Z][A-Za-z0-9]*/g) ?? []);
  };

  const templates = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return templates(full);
      return entry.isFile() && entry.name.endsWith('.html') ? [full] : [];
    });

  it('covers every icon the dashboard templates ask for by name', () => {
    const registered = registeredIcons();

    const missing = templates(appRoot).flatMap((file) => {
      const names = readFileSync(file, 'utf8').matchAll(/<lucide-icon[^>]*\sname="([A-Za-z0-9]+)"/g);
      return [...names]
        .map((match) => match[1])
        .filter((name) => !registered.has(name))
        .map((name) => `${name} (${file.replace(appRoot, '')})`);
    });

    expect(missing).toEqual([]);
  });
});
