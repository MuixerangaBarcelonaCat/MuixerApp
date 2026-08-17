/**
 * Wording for «on sou?» — the sentence that tells a member where they stand in a figure.
 *
 * Pure formatting only: it takes already-resolved names and neighbours and produces the phrase.
 * Deriving *which* node is the caller's, and who its neighbours are, belongs to whoever holds the
 * domain model — `@muixer/pinyes-render` for the projection screen, the `me` API module for the
 * event summary. Both share this file so the two screens can never drift apart in wording.
 *
 * Conventions, both deliberate (see the plan's «Catalan» section):
 *   - No article before a figure name («a Roscana», not «a la Roscana») nor before an alias
 *     («darrere de Marta»): grammatical gender is not stored, so «al Piló» vs «a la Roscana»
 *     is not derivable.
 *   - Nothing here uppercases. The mock shows the label and the aliases in caps; that is
 *     `text-transform` on the tagged segments, so the underlying data stays intact.
 */

/**
 * One piece of the phrase, tagged with what it is so the template can style it — the label and
 * aliases are uppercased, the figure name takes its palette colour. A plain string could not
 * carry that, and splitting the wording across the util and the template would defeat the point
 * of sharing it.
 */
export type OwnPositionSegment =
  | { kind: 'text'; value: string }
  | { kind: 'label'; value: string }
  | { kind: 'figure'; value: string }
  | { kind: 'alias'; value: string };

export interface OwnPositionInput {
  /** The node's own label — what the tècniques named the position, e.g. «Lateral». */
  nodeLabel: string;
  /** The node's `renglaPosition`; null when the node is not part of a rengla. */
  cordon: number | null;
  /** Omitted when the segment holds a single figure — there is nothing to disambiguate. */
  figureName: string | null;
  /** PINYA only: the alias one rengla position inward, or null when there is nobody there. */
  behind?: string | null;
  /** TRONC only: aliases of the people you stand on. */
  below?: string[];
  /** TRONC only: aliases of the people standing on you. */
  above?: string[];
}

/** Shown instead of the phrase when a member somehow holds more than one placement (invariant 4). */
export const OWN_POSITION_MULTIPLE_PLACEMENTS =
  "Sou en més d'un lloc alhora. La comi sanitària no recomana " +
  'partir-se pel mig. Parleu amb la tècnica.';

/** Shown when the member is not in this segment at all — silence would read as a bug. */
export const OWN_POSITION_NO_PLACEMENT = 'No teniu cap posició en este segment.';

const VOWEL_OR_H = /^[aeiouàáèéêíìïòóôúùüh]/i;

/** The correct form of «de» before `name`: elided to «d'» before a vowel or a silent h. */
export function elideDe(name: string): string {
  return VOWEL_OR_H.test(name) ? "d'" : 'de ';
}

export function formatOwnPosition(input: OwnPositionInput): OwnPositionSegment[] {
  const segments: OwnPositionSegment[] = [{ kind: 'text', value: 'Sou ' }, { kind: 'label', value: input.nodeLabel }];

  if (input.cordon != null) {
    segments.push({ kind: 'text', value: ` (cordó ${input.cordon})` });
  }

  if (input.figureName) {
    segments.push({ kind: 'text', value: ' a ' }, { kind: 'figure', value: input.figureName });
  }

  if (input.behind) {
    segments.push({ kind: 'text', value: `, darrere ${elideDe(input.behind)}` }, { kind: 'alias', value: input.behind });
  }

  pushNeighbours(segments, 'damunt', input.below);
  pushNeighbours(segments, 'davall', input.above);

  segments.push({ kind: 'text', value: '.' });
  return mergeText(segments);
}

export interface OwnPositionSummaryInput {
  /** The node's own label — what the tècniques named the position, e.g. «Vent». */
  nodeLabel: string;
  /** The node's `renglaPosition`; null when the node is not part of a rengla. */
  cordon: number | null;
  /** Omitted when the segment holds a single figure — there is nothing to disambiguate. */
  figureName: string | null;
}

export interface OwnPositionSummary {
  /** Uppercased by the template, same convention as `formatOwnPosition`'s `label` segment. */
  nodeLabel: string;
  /** The `(C{n})`/`a {figure}` clauses, in normal case, concatenated after `nodeLabel`. */
  suffix: string;
}

/**
 * The reduced, single-line form used in list rows (the event summary) rather than the full
 * sentence `formatOwnPosition` renders on the projection screen: `«Vent (C1) a Roscana»`. No
 * «darrere de», no davall/damunt, no colour — those need either a rengla join or the palette
 * index, and neither earns its complexity in a list row. Split into `nodeLabel`/`suffix` rather
 * than a single string so the template can style the label alone (uppercase) without touching
 * the data — the same convention `formatOwnPosition`'s tagged segments follow.
 */
export function formatOwnPositionSummary(input: OwnPositionSummaryInput): OwnPositionSummary {
  let suffix = '';
  if (input.cordon != null) suffix += ` (C${input.cordon})`;
  if (input.figureName) suffix += ` a ${input.figureName}`;
  return { nodeLabel: input.nodeLabel, suffix };
}

export function ownPositionToPlainText(segments: OwnPositionSegment[]): string {
  return segments.map((segment) => segment.value).join('');
}

/** Appends «, damunt de X i Y» / «, davall de Z», or nothing when that floor is empty. */
function pushNeighbours(segments: OwnPositionSegment[], preposition: string, aliases: string[] | undefined): void {
  if (!aliases?.length) return;

  segments.push({ kind: 'text', value: `, ${preposition} ${elideDe(aliases[0])}` });

  aliases.forEach((alias, index) => {
    segments.push({ kind: 'alias', value: alias });
    if (index < aliases.length - 2) segments.push({ kind: 'text', value: ', ' });
    else if (index === aliases.length - 2) segments.push({ kind: 'text', value: ' i ' });
  });
}

/** Collapses runs of text so the template never renders an adjacent pair of bare spans. */
function mergeText(segments: OwnPositionSegment[]): OwnPositionSegment[] {
  return segments.reduce<OwnPositionSegment[]>((acc, segment) => {
    const previous = acc[acc.length - 1];
    if (segment.kind === 'text' && previous?.kind === 'text') {
      acc[acc.length - 1] = { kind: 'text', value: previous.value + segment.value };
      return acc;
    }
    acc.push(segment);
    return acc;
  }, []);
}
