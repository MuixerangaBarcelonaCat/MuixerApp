#!/usr/bin/env node
/**
 * Regenerates the auto-generated section of docs/MAP.md from the real repo structure.
 *
 *   pnpm run docs:map
 *
 * Everything between the AUTO markers is replaced; the hand-written parts of MAP.md are untouched.
 * Keep this dumb on purpose: it reads directories, it does not parse TypeScript.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAP_FILE = join(ROOT, 'docs/MAP.md');
const BEGIN = '<!-- BEGIN:AUTO — generat per scripts/generate-doc-map.mjs, no editar a mà -->';
const END = '<!-- END:AUTO -->';

const dirs = (p) =>
  existsSync(p)
    ? readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];

const files = (p, ext = '.ts') =>
  existsSync(p)
    ? readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(ext))
        .map((e) => e.name)
        .sort()
    : [];

/** Recursively count .ts files (excluding specs) and total lines under a directory. */
function measure(p) {
  let count = 0;
  let lines = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        count++;
        lines += readFileSync(full, 'utf8').split('\n').length;
      }
    }
  };
  if (existsSync(p) && statSync(p).isDirectory()) walk(p);
  return { count, lines };
}

const link = (p, label) => `[${label ?? p}](../${relative(ROOT, p)})`;

/** Docs a module/feature is most likely documented by, as Obsidian wikilinks. */
const DOC_HINTS = {
  auth: ['AUTH_FLOW', 'SSE_AUTH'],
  sync: ['SYNC_ARCHITECTURE', 'API_APPSISTENCIA'],
  figure: ['PINYES_MODULE', 'DATA_MODEL'],
  composition: ['PINYES_MODULE'],
  'event-segment': ['PINYES_MODULE'],
  'node-assignment': ['PINYES_MODULE'],
  person: ['DATA_MODEL'],
  'person-delegate': ['DATA_MODEL'],
  event: ['DATA_MODEL'],
  season: ['DATA_MODEL'],
  user: ['DATA_MODEL'],
  tag: ['DATA_MODEL'],
  database: ['DATA_MODEL'],
  legal: ['GDPR_COMPLIANCE'],
  audit: ['GDPR_COMPLIANCE'],
  pinyes: ['PINYES_MODULE', 'DASHBOARD_UI'],
  persons: ['DASHBOARD_UI'],
  events: ['DASHBOARD_UI'],
  config: ['DASHBOARD_UI'],
  home: ['DASHBOARD_UI'],
};

const hints = (name) => (DOC_HINTS[name] ?? []).map((d) => `[[${d}]]`).join(' · ') || '—';

function table(rows) {
  return ['| Element | Fitxers | Línies | Docs |', '|---------|--------:|-------:|------|', ...rows].join('\n');
}

function section(title, base, names) {
  const rows = names.map((name) => {
    const { count, lines } = measure(join(base, name));
    return `| ${link(join(base, name), `\`${name}\``)} | ${count} | ${lines} | ${hints(name)} |`;
  });
  return `### ${title}\n\n${table(rows)}\n`;
}

const apiModules = join(ROOT, 'apps/api/src/modules');
const dashFeatures = join(ROOT, 'apps/dashboard/src/app/features');
const pwaFeatures = join(ROOT, 'apps/pwa/src/app/features');
const sharedSrc = join(ROOT, 'libs/shared/src');

const migrations = files(join(ROOT, 'apps/api/src/migrations')).length;

const sharedRows = dirs(sharedSrc).map((name) => {
  const { count, lines } = measure(join(sharedSrc, name));
  return `| ${link(join(sharedSrc, name), `\`${name}\``)} | ${count} | ${lines} | — |`;
});

const biggest = (() => {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) {
        out.push({ full, lines: readFileSync(full, 'utf8').split('\n').length });
      }
    }
  };
  for (const p of ['apps/api/src', 'apps/dashboard/src', 'apps/pwa/src', 'libs/shared/src']) walk(join(ROOT, p));
  return out
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10)
    .map((f) => `| ${link(f.full, `\`${relative(ROOT, f.full)}\``)} | ${f.lines} |`);
})();

const generated = [
  BEGIN,
  '',
  `> Generat el ${new Date().toISOString().slice(0, 10)} amb \`pnpm run docs:map\`.`,
  '',
  section('Mòduls de l\'API (`apps/api/src/modules`)', apiModules, dirs(apiModules)),
  `Migracions TypeORM: **${migrations}** a ${link(join(ROOT, 'apps/api/src/migrations'), '`apps/api/src/migrations`')}.`,
  '',
  section('Features del dashboard (`apps/dashboard/src/app/features`)', dashFeatures, dirs(dashFeatures)),
  section('Features de la PWA (`apps/pwa/src/app/features`)', pwaFeatures, dirs(pwaFeatures)),
  `### Codi compartit (\`libs/shared/src\`)\n\n${table(sharedRows)}\n`,
  '### Fitxers més grans (candidats a dividir)\n',
  '| Fitxer | Línies |',
  '|--------|-------:|',
  ...biggest,
  '',
  END,
].join('\n');

const current = readFileSync(MAP_FILE, 'utf8');
const start = current.indexOf(BEGIN);
const finish = current.indexOf(END);
if (start === -1 || finish === -1) {
  console.error(`No s'han trobat els marcadors AUTO a ${MAP_FILE}`);
  process.exit(1);
}
writeFileSync(MAP_FILE, current.slice(0, start) + generated + current.slice(finish + END.length));
console.log(`docs/MAP.md actualitzat (${dirs(apiModules).length} mòduls API, ${dirs(dashFeatures).length} features dashboard).`);
