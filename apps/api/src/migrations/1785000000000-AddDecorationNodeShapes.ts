import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDecorationNodeShapes1785000000000 implements MigrationInterface {
  name = 'AddDecorationNodeShapes1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['ARROW_LEFT', 'ARROW_UP', 'ARROW_DOWN', 'DOUBLE_ARROW', 'TRIANGLE', 'STAR']) {
      await queryRunner.query(`ALTER TYPE "public"."node_shape_enum" ADD VALUE IF NOT EXISTS '${value}'`);
    }
  }

  // Postgres cannot drop a single enum value in place — same no-op precedent as
  // AddAdHocInstanceNodes1781200000000's own ARROW/CIRCLE addition.
  public async down(): Promise<void> {
    return;
  }
}
