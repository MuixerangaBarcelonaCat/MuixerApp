import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trigram indexes for the person search boxes.
 *
 * `EnableFuzzySearch1781400000000` installed `pg_trgm` but never created an index with it,
 * so every `ILIKE '%…%'` over persons was a sequential scan with `unaccent()` re-evaluated
 * per row.
 *
 * A plain `gin_trgm_ops` index on the column would not have been used: the predicates search
 * `unaccent(lower(col))`, and Postgres only matches an index whose expression is exactly the
 * one in the query. Indexing that expression directly is rejected too, because `unaccent()`
 * is STABLE rather than IMMUTABLE (its dictionary can be redefined at runtime).
 *
 * `f_unaccent` is the standard wrapper around that: it pins the dictionary with an explicit
 * `regdictionary` argument and is declared IMMUTABLE so it can be indexed. The declaration is
 * only true as long as nobody redefines the `unaccent` dictionary — if that ever happens,
 * these indexes must be REINDEXed.
 *
 * Everything inside the function body is schema-qualified, and the function pins its own
 * `search_path`. Without that, a `pg_dump` of this database does not restore: pg_dump runs the
 * restore with `search_path = ''`, the bare `'unaccent'::regdictionary` fails to resolve, and
 * every CREATE INDEX below is silently skipped — leaving a restored database whose person
 * searches are back to sequential scans with nothing in the logs to say so.
 */
export class AddPersonSearchTrigramIndexes1785400000000 implements MigrationInterface {
  name = 'AddPersonSearchTrigramIndexes1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.f_unaccent(text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE PARALLEL SAFE STRICT
      SET search_path = pg_catalog, public
      AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
    `);

    for (const column of ['alias', 'name', 'firstSurname', 'secondSurname']) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_persons_trgm_${column.toLowerCase()}"
        ON "persons" USING gin (public.f_unaccent(lower("${column}")) gin_trgm_ops)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['alias', 'name', 'firstSurname', 'secondSurname']) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_persons_trgm_${column.toLowerCase()}"`);
    }
    // Dropped last: the indexes above depend on it.
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.f_unaccent(text)`);
  }
}
