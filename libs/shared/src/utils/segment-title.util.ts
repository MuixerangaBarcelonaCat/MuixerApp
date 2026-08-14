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

export function getSegmentInstanceLabel(instance: SegmentTitleInstance): string {
  const base = instance.label ?? instance.figureTemplate?.name ?? '?';
  if (instance.figureTemplate?.hasPinya) {
    if (instance.figureMode === 'PEU') return `Peu de ${base}`;
    if (instance.figureMode === 'REMAT') return `Remat de ${base}`;
    if (instance.figureMode === 'NETA') return `${base} ${netaSuffix(base)}`;
  }
  return base;
}

function netaSuffix(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? '';
  return firstWord.endsWith('a') ? 'neta' : 'net';
}
