import { DIRECTION_SLOTS } from '../constants/node-preset.constants';

export interface DirectionAssignmentEntry {
  /** The direction flavour: `direccio-tronc` / `direccio-xicalla` / `direccio-pinya`. */
  positionType: string | null;
  /** The assigned person's alias. */
  personAlias: string;
}

export interface FormatDirectionNamesOptions {
  /** Restrict to these flavours (e.g. only `direccio-pinya` for the pinya view). Default: all. */
  positionTypes?: readonly string[];
  /**
   * Append the flavour marker after the name — «Aina (X)», «Pep (P)», tronc unmarked. Default
   * true. Set false when the list is already scoped to one flavour and the marker is just noise.
   */
  markers?: boolean;
}

/**
 * The people directing a figure, as display strings in the fixed `DIRECTION_SLOTS` order
 * (tronc → xicalla → pinya). Shared so the segment-manager summary, the tronc view and the
 * projection can never word this differently. Names within one flavour keep their input order.
 */
export function formatDirectionNames(
  directions: readonly DirectionAssignmentEntry[],
  options: FormatDirectionNamesOptions = {},
): string[] {
  const { positionTypes, markers = true } = options;
  const names: string[] = [];

  for (const slot of DIRECTION_SLOTS) {
    if (positionTypes && !positionTypes.includes(slot.positionType)) continue;
    for (const entry of directions.filter((d) => d.positionType === slot.positionType)) {
      names.push(
        markers && slot.projectionMarker
          ? `${entry.personAlias} (${slot.projectionMarker})`
          : entry.personAlias,
      );
    }
  }

  return names;
}
