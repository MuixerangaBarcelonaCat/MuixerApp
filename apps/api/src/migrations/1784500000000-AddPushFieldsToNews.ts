import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushFieldsToNews1784500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "news"
        ADD COLUMN "sendPush" boolean NOT NULL DEFAULT false,
        ADD COLUMN "pushSentAt" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "news"
        DROP COLUMN "sendPush",
        DROP COLUMN "pushSentAt"
    `);
  }
}
