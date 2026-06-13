import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdHocInstanceNodes1781200000000 implements MigrationInterface {
  name = 'AddAdHocInstanceNodes1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "instance_nodes" ADD COLUMN "isAdHoc" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_nodes" ADD COLUMN "createdById" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_nodes" ADD CONSTRAINT "FK_instance_nodes_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."figure_zone_enum" ADD VALUE IF NOT EXISTS 'DECORATION'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."node_shape_enum" ADD VALUE IF NOT EXISTS 'ARROW'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."node_shape_enum" ADD VALUE IF NOT EXISTS 'CIRCLE'`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_instance_nodes_instance_adhoc" ON "instance_nodes" ("figureInstanceId", "isAdHoc")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_instance_nodes_instance_adhoc"`);
    await queryRunner.query(
      `ALTER TABLE "instance_nodes" DROP CONSTRAINT IF EXISTS "FK_instance_nodes_createdBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_nodes" DROP COLUMN IF EXISTS "createdById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_nodes" DROP COLUMN IF EXISTS "isAdHoc"`,
    );
  }
}
