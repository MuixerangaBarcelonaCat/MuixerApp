export const environment = {
  production: false,
  apiUrl: '/api',
  /** Polling interval (ms) for attendance-facing screens (events list, event detail). */
  attendancePollIntervalMs: 25000,
  /** Polling interval (ms) for the cheap projection-version check (see segment projection). */
  projectionPollIntervalMs: 25000,
};
