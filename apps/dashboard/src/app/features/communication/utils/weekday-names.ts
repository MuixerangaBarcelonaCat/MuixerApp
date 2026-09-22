/** Index matches JS `Date.getDay()` / `WeeklyScheduleConfig.dayOfWeek` (0 = Sunday .. 6 = Saturday). */
export const WEEKDAY_NAMES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'] as const;

/** `dayOfWeek` values in the order they should be listed (Monday-first, Sunday last) — display
 *  order only, kept separate from `WEEKDAY_NAMES` so its indices stay tied to `Date.getDay()`. */
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
