import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUpdatedAtToMissingTables1749106400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'instance_nodes',
      new TableColumn({
        name: 'updatedAt',
        type: 'timestamp without time zone',
        default: 'now()',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'composition_slots',
      new TableColumn({
        name: 'createdAt',
        type: 'timestamp without time zone',
        default: 'now()',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'composition_slots',
      new TableColumn({
        name: 'updatedAt',
        type: 'timestamp without time zone',
        default: 'now()',
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('composition_slots', 'updatedAt');
    await queryRunner.dropColumn('composition_slots', 'createdAt');
    await queryRunner.dropColumn('instance_nodes', 'updatedAt');
  }
}
