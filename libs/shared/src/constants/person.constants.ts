/** Baseline (cm) for relative shoulder height display (+/- from this value). */
export const SHOULDER_HEIGHT_BASELINE_CM = 140;

/**
 * Checked-in (`ASSISTIT`) events a person needs to be given the camisa. Only events with
 * `countsForStatistics` count, over all seasons. Hard-coded until colla config exists (DEBT F20).
 */
export const SHIRT_REQUIREMENTS = { performances: 2, rehearsals: 6 } as const;
