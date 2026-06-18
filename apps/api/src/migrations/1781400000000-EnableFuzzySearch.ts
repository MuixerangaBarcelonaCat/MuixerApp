import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableFuzzySearch1781400000000 implements MigrationInterface {
  name = 'EnableFuzzySearch1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Extensions are intentionally not dropped — other parts of the DB may rely on them
  }
}
