import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds "standsOnNodeIds" to figure_nodes and instance_nodes: for a TRONC node, the BASE/TRONC
 * nodes of the floor directly below that this person stands on once the figure is built. Plain
 * uuid[] (no FK, like renglaId/originNodeId) — the template service validates it against the
 * same template's nodes on every save, and the snapshot remaps it to InstanceNode ids.
 */
export class AddNodeStandsOn1786300000000 implements MigrationInterface {
  name = 'AddNodeStandsOn1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "figure_nodes" ADD COLUMN "standsOnNodeIds" uuid[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_nodes" ADD COLUMN "standsOnNodeIds" uuid[] NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "instance_nodes" DROP COLUMN "standsOnNodeIds"`);
    await queryRunner.query(`ALTER TABLE "figure_nodes" DROP COLUMN "standsOnNodeIds"`);
  }
}
