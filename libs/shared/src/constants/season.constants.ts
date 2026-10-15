/**
 * `code` of the 409 the API returns when a season edit or delete would leave events whose date falls
 * in no season. Clients detect it by this code (not by message text) and may resend the request with
 * `allowUncovered=true` once the user confirms.
 */
export const SEASON_LEAVES_EVENTS_UNCOVERED = 'SEASON_LEAVES_EVENTS_UNCOVERED';
