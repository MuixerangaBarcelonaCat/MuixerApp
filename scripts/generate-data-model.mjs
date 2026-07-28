#!/usr/bin/env node
/**
 * Regenerates the auto-generated section of docs/DATA_MODEL.md by reading the TypeORM entities.
 *
 *   pnpm run docs:model
 *
 * The entities are the source of truth; this script only reformats them. Hand-written parts of
 * DATA_MODEL.md (invariants, design notes) live outside the AUTO markers and are preserved.
 *
 * It is a regex reader, not a TypeScript parser: it relies on the project convention of one
 * decorator block per property. If an entity stops following it, fix the entity or this script —
 * do not hand-edit the generated section.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = join(ROOT, 'apps/api/src');
const TARGET = join(ROOT, 'docs/DATA_MODEL.md');
const BEGIN = '<!-- BEGIN:AUTO — generat per scripts/generate-data-model.mjs, no editar a mà -->';
const END = '<!-- END:AUTO -->';

function entityFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) entityFiles(full, out);
    else if (entry.name.endsWith('.entity.ts')) out.push(full);
  }
  return out;
}

const RELATIONS = ['ManyToOne', 'OneToMany', 'ManyToMany', 'OneToOne'];

function parseEntity(file) {
  const src = readFileSync(file, 'utf8');
  const table = src.match(/@Entity\(\s*'([^']+)'/)?.[1];
  if (!table) return null;
  const className = src.match(/export class (\w+)/)?.[1] ?? '?';
  const uniques = [...src.matchAll(/@Unique\(\[([^\]]+)\]\)/g)].map((m) =>
    m[1].replace(/['\s]/g, '').split(',').join(' + '),
  );

  const props = [];
  let pending = [];
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('@')) pending.push(line);
    const prop = line.match(/^(\w+)(\??):\s*(.+?);$/);
    if (prop && pending.length) {
      const decorators = pending.join(' ');
      pending = [];
      const [, name, optional, tsType] = prop;
      const relation = RELATIONS.find((r) => decorators.includes(`@${r}(`));
      const target = decorators.match(/=>\s*(\w+)/)?.[1];
      const enumName = decorators.match(/enum:\s*(\w+)/)?.[1];
      const dbType = decorators.match(/type:\s*'([^']+)'/)?.[1];
      const notes = [];
      if (relation) notes.push(`${relation} → \`${target}\``);
      if (decorators.includes('@PrimaryGeneratedColumn')) notes.push('PK');
      if (enumName) notes.push(`enum \`${enumName}\``);
      if (/unique:\s*true/.test(decorators)) notes.push('unique');
      const def = decorators.match(/default:\s*([^,}]+)/)?.[1]?.trim();
      // Object/array literal defaults span lines and are not worth inlining here.
      if (def && !/[{[]/.test(def)) notes.push(`default \`${def}\``);
      if (decorators.includes('@CreateDateColumn')) notes.push('creació');
      if (decorators.includes('@UpdateDateColumn')) notes.push('actualització');
      const onDelete = decorators.match(/onDelete:\s*'([^']+)'/)?.[1];
      if (onDelete) notes.push(`onDelete ${onDelete}`);
      const nullable = /nullable:\s*true/.test(decorators) || optional === '?' || / \| null$/.test(tsType);
      props.push({
        name,
        type: dbType ?? (relation ? 'relation' : '—'),
        tsType: tsType.replace(/\s*\|\s*null$/, ''),
        nullable,
        notes: notes.join(', ') || '—',
      });
    }
    if (line.endsWith(';') && !line.startsWith('@')) pending = [];
  }
  return { file, table, className, uniques, props };
}

const entities = entityFiles(API_SRC)
  .map(parseEntity)
  .filter(Boolean)
  .sort((a, b) => a.table.localeCompare(b.table));

const blocks = entities.map((e) => {
  // `|` would break the markdown table cell (union types).
  const cell = (s) => s.replace(/\|/g, '\\|');
  const rows = e.props.map(
    (p) =>
      `| \`${p.name}\` | \`${p.type}\` | \`${cell(p.tsType)}\` | ${p.nullable ? 'sí' : 'no'} | ${p.notes} |`,
  );
  return [
    `### \`${e.table}\` — \`${e.className}\``,
    '',
    `Definició: [\`${relative(ROOT, e.file)}\`](../${relative(ROOT, e.file)})`,
    ...(e.uniques.length ? ['', `**Unique:** ${e.uniques.map((u) => `\`${u}\``).join(' · ')}`] : []),
    '',
    '| Camp | Tipus DB | Tipus TS | Nullable | Notes |',
    '|------|----------|----------|----------|-------|',
    ...rows,
    '',
  ].join('\n');
});

const overview = [
  '| Taula | Entitat | Camps |',
  '|-------|---------|------:|',
  ...entities.map((e) => `| \`${e.table}\` | \`${e.className}\` | ${e.props.length} |`),
].join('\n');

const ENUM_DIR = join(ROOT, 'libs/shared/src/enums');
const enums = readdirSync(ENUM_DIR)
  .filter((f) => f.endsWith('.enum.ts'))
  .map((f) => {
    const src = readFileSync(join(ENUM_DIR, f), 'utf8');
    const name = src.match(/export enum (\w+)/)?.[1];
    if (!name) return null;
    const values = [...src.matchAll(/^\s+(\w+)\s*=\s*'([^']+)'/gm)].map((m) => m[2]);
    return `| \`${name}\` | ${values.map((v) => `\`${v}\``).join(' · ')} |`;
  })
  .filter(Boolean);

const generated = [
  BEGIN,
  '',
  `> Generat el ${new Date().toISOString().slice(0, 10)} des de les entitats TypeORM amb \`pnpm run docs:model\`.`,
  `> **${entities.length} entitats.** No editar a mà: canvia l'entitat i torna a executar l'script.`,
  '',
  '### Resum',
  '',
  overview,
  '',
  '### Enums (`libs/shared/src/enums`)',
  '',
  '| Enum | Valors |',
  '|------|--------|',
  ...enums,
  '',
  ...blocks,
  END,
].join('\n');

const current = readFileSync(TARGET, 'utf8');
const start = current.indexOf(BEGIN);
const finish = current.indexOf(END);
if (start === -1 || finish === -1) {
  console.error(`No s'han trobat els marcadors AUTO a ${TARGET}`);
  process.exit(1);
}
writeFileSync(TARGET, current.slice(0, start) + generated + current.slice(finish + END.length));
console.log(`docs/DATA_MODEL.md actualitzat (${entities.length} entitats).`);
