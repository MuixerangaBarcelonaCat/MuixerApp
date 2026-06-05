import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

export class AddPersonInstanceUniqueConstraint1749106500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createUniqueConstraint(
      'node_assignments',
      new TableUnique({
        name: 'UQ_node_assignments_instance_person',
        columnNames: ['figureInstanceId', 'personId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint(
      'node_assignments',
      'UQ_node_assignments_instance_person',
    );
  }
}
