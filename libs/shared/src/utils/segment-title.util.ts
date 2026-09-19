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

/** A `SegmentTitleInstance` carrying its id, so per-instance display names can be keyed back. */
export type NumberedSegmentInstance = SegmentTitleInstance & { id: string };

/**
 * Per-instance display names for a segment's figures. When two or more figures resolve to the
 * same label (`getSegmentInstanceLabel`), each gets a trailing ordinal in the given order —
 * «Pilar 1», «Pilar 2», … — while a label held by a single figure is left bare («Pilar»).
 *
 * Purely derived from the current set: adding a duplicate renumbers the group, removing figures
 * until one remains drops the number again. Nothing is written back to the instance. `instances`
 * must already be in the order the numbers should follow (creation / `sortOrder`).
 */
export function computeInstanceDisplayNames(instances: NumberedSegmentInstance[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const instance of instances) {
    const label = getSegmentInstanceLabel(instance);
    const ids = groups.get(label) ?? [];
    ids.push(instance.id);
    groups.set(label, ids);
  }

  const names = new Map<string, string>();
  for (const [label, ids] of groups) {
    if (ids.length === 1) {
      names.set(ids[0], label);
    } else {
      ids.forEach((id, index) => names.set(id, `${label} ${index + 1}`));
    }
  }
  return names;
}

function netaSuffix(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? '';
  return firstWord.endsWith('a') ? 'neta' : 'net';
}
