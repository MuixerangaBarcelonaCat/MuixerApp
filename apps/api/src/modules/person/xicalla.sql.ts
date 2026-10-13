import { DEFAULT_COLLA_SETTINGS } from '@muixer/shared';

/** Today's date in Valencia time (the colla's timezone), as a Postgres `date`. */
const LOCAL_TODAY_SQL = `(now() AT TIME ZONE 'Europe/Madrid')::date`;

/**
 * The one SQL source of the xicalla rule: by age when the birth date is known, otherwise the flag
 * set by hand. The age of majority is read from `colla_settings` by an uncorrelated subquery
 * (Postgres runs it once per query), so call sites need no parameter; a missing row falls back to
 * the default instead of turning every value NULL.
 *
 * `alias` is the persons alias as it should appear in the SQL (quoted or not). `today` exists for
 * tests; real callers keep the default. TS mirror: `deriveIsXicalla` in `@muixer/shared`.
 */
export function xicallaSql(alias: string, today: string = LOCAL_TODAY_SQL): string {
  const majorityAge = `COALESCE((SELECT "majorityAge" FROM "colla_settings" LIMIT 1), ${DEFAULT_COLLA_SETTINGS.majorityAge})`;
  return `CASE WHEN ${alias}."birthDate" IS NULL THEN ${alias}."isXicallaManual"
    ELSE ${alias}."birthDate" > (${today} - make_interval(years => ${majorityAge}))::date END`;
}
