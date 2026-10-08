import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes a figure's `sortOrder` unique within its segment. Parallel creates used to read the same
 * `MAX(sortOrder)` and land on the same value, and Postgres returns ties in no stable order — so
 * each view could list, number («Pilar 1/2») and color the same figures differently.
 *
 * Existing segments are renumbered 0..n-1 by (sortOrder, createdAt, id): ties fall back to
 * "added first", and rows written in the same transaction (identical `createdAt`) to `id`. The
 * constraint is DEFERRABLE INITIALLY DEFERRED so the reorder/move loops, which rewrite one row at
 * a time, may pass through transient duplicates before commit.
 */
export class UniqueFigureInstanceSortOrder1786000000000 implements MigrationInterface {
  name = 'UniqueFigureInstanceSortOrder1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "figure_instances" fi
       SET "sortOrder" = ranked."rank"
       FROM (
         SELECT "id",
                ROW_NUMBER() OVER (PARTITION BY "segmentId" ORDER BY "sortOrder", "createdAt", "id") - 1 AS "rank"
         FROM "figure_instances"
       ) ranked
       WHERE fi."id" = ranked."id" AND fi."sortOrder" <> ranked."rank"`,
    );
    await queryRunner.query(
      `ALTER TABLE "figure_instances"
       ADD CONSTRAINT "UQ_figure_instances_segment_sort_order" UNIQUE ("segmentId", "sortOrder")
       DEFERRABLE INITIALLY DEFERRED`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The renumbering is not undone: 0..n-1 is a valid order under the old schema too.
    await queryRunner.query(
      `ALTER TABLE "figure_instances" DROP CONSTRAINT "UQ_figure_instances_segment_sort_order"`,
    );
  }
}
