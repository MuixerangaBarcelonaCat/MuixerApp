/**
 * `figureMode` is typed as a plain string (rather than the `FigureMode` enum) so this shape
 * stays structurally compatible with both the API's actual `FigureMode` enum values and the
 * Dashboard's local `FigureMode` string-union type — TypeScript string enums are not
 * structurally assignable to/from unrelated string-literal unions even when the values match.
 */
export interface SegmentTitleInstance {
  label: string | null;
  figureMode: string;
  figureTemplate: { name: string; hasPinya: boolean } | null;
}

/**
 * The title shown for a segment: the user-assigned name if set, otherwise derived live
 * from its figures — kept in sync automatically as figures are added/removed/renamed.
 */
export function computeSegmentDisplayName(
  name: string | null,
  instances: SegmentTitleInstance[],
): string {
  if (name) return name;
  if (instances.length === 0) return 'Segment sense nom';

  const counts = new Map<string, number>();
  for (const instance of instances) {
    const label = getSegmentInstanceLabel(instance);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts, ([label, count]) => (count > 1 ? `${count} ${label}` : label)).join(' + ');
}

/**
 * Not gated on `figureTemplate.hasPinya` — that field is overloaded across the two endpoints
 * that populate this shape. The segment-list endpoint reports it structurally (does the template
 * have pinya nodes at all); the projection endpoint reports it mode-collapsed
 * (`hasPinyaNodes && mode !== REMAT && mode !== NETA` — see `projection.service.ts`), which is
 * false for exactly the modes below. Gating on it here would make PEU/REMAT/NETA unreachable for
 * any caller fed projection data.
 */
export function getSegmentInstanceLabel(instance: SegmentTitleInstance): string {
  const base = instance.label ?? instance.figureTemplate?.name ?? '?';
  if (instance.figureMode === 'PEU') return `Peu de ${base}`;
  if (instance.figureMode === 'REMAT') return `Remat de ${base}`;
  if (instance.figureMode === 'NETA') return `${base} ${netaSuffix(base)}`;
  return base;
}

function netaSuffix(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? '';
  return firstWord.endsWith('a') ? 'neta' : 'net';
}
