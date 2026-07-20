import * as path from 'path';

/** Where per-device JSON metrics and screenshots are written. */
export const RESULTS_DIR = path.join(__dirname, '..', '..', 'audit-results');
export const SHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
