#!/usr/bin/env node
/**
 * Design-system token drift check (Phase 6.1 of docs/superpowers/specs/2026-08-16-design-system-plan-design.md).
 *
 *   pnpm run lint:tokens
 *
 * Reports raw hex color literals and color-related Tailwind arbitrary-value syntax
 * (bg-[...], text-[...], etc.) found outside libs/ui/src/lib/tokens/ — see DESIGN_SYSTEM.md's
 * usage rules #2/#3. Warn-only by design (like `pnpm run lint:dead` / knip): Tier 3 restyling
 * (~25 existing components, per the plan's Phase 1 audit) hasn't happened yet, so a hard fail
 * right now would block unrelated PRs on pre-existing drift, not new regressions. Always exits 0.
 * Keep this dumb on purpose: it's a regex scan, not a real CSS/TS parser — false positives (a CSS
 * id that happens to look like a hex triplet, an already-justified arbitrary value) are expected
 * and fine for a report a human skims, not a gate.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_ROOTS = ['apps/dashboard/src', 'apps/pwa/src', 'libs/pinyes-render/src', 'libs/ui/src'];

const SCAN_EXTENSIONS = new Set(['.ts', '.html']);

// The token definition files themselves — raw hex belongs here, and nowhere else.
const EXCLUDE_PATH_SEGMENT = 'libs/ui/src/lib/tokens/';

// No `g` flag — each pattern is only ever used with .test() below, which is stateful (lastIndex)
// on global regexes reused across many .test() calls, a classic footgun for a loop like this one.
const HEX_PATTERN = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

// Color-related Tailwind utility prefixes only — arbitrary values for layout/sizing
// (max-h-[85vh], w-[...]) aren't a token violation, so they're deliberately not flagged here.
const ARBITRARY_TAILWIND_PATTERN =
  /\b(?:bg|text|border(?:-[trblxy])?|ring(?:-offset)?|divide|outline|decoration|accent|caret|fill|stroke|from|via|to|shadow)-\[[^\]]+\]/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (SCAN_EXTENSIONS.has(extname(entry.name)) && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.test.ts')) {
      yield full;
    }
  }
}

/** @type {Map<string, {line: number, snippet: string, kind: 'hex' | 'arbitrary'}[]>} */
const findings = new Map();

for (const root of SCAN_ROOTS) {
  const absRoot = join(ROOT, root);
  if (!statSync(absRoot, { throwIfNoEntry: false })?.isDirectory()) continue;

  for (const file of walk(absRoot)) {
    const relPath = relative(ROOT, file).replaceAll('\\', '/');
    if (relPath.includes(EXCLUDE_PATH_SEGMENT)) continue;

    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // One flag per line/kind is enough for a human-skimmed report — not counting every match.
      if (HEX_PATTERN.test(line)) add(relPath, i + 1, line.trim(), 'hex');
      if (ARBITRARY_TAILWIND_PATTERN.test(line)) add(relPath, i + 1, line.trim(), 'arbitrary');
    });
  }
}

function add(file, line, snippet, kind) {
  const list = findings.get(file) ?? [];
  list.push({ line, snippet, kind });
  findings.set(file, list);
}

const files = [...findings.keys()].sort();
const total = files.reduce((sum, f) => sum + findings.get(f).length, 0);

if (total === 0) {
  console.log('[design-tokens] No raw hex colors or color-related Tailwind arbitrary values found outside libs/ui/src/lib/tokens/.');
  process.exit(0);
}

console.log(`[design-tokens] ${total} finding(s) across ${files.length} file(s) — raw hex / arbitrary color values outside token files.`);
console.log('[design-tokens] Warn-only (Phase 6.1): does not fail CI. See docs/DESIGN_SYSTEM.md usage rules #2/#3.\n');

for (const file of files) {
  console.log(file);
  for (const { line, snippet, kind } of findings.get(file)) {
    console.log(`  ${line}:${kind === 'hex' ? 'hex' : 'arbitrary'}  ${snippet}`);
  }
}

process.exit(0);
