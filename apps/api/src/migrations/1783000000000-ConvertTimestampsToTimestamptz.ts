import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ARCH-4: all `timestamp` (without time zone) columns become `timestamptz`.
 * Existing values were always written/read assuming the app and DB share UTC,
 * so reinterpreting them `AT TIME ZONE 'UTC'` on the way in is lossless.
 */
const TIMESTAMP_COLUMNS: Array<[table: string, column: string]> = [
  ['refresh_tokens', 'expires_at'],
  ['refresh_tokens', 'used_at'],
  ['refresh_tokens', 'revoked_at'],
  ['refresh_tokens', 'created_at'],
  ['compositions', 'createdAt'],
  ['compositions', 'updatedAt'],
  ['attendances', 'respondedAt'],
  ['attendances', 'lastSyncedAt'],
  ['attendances', 'createdAt'],
  ['attendances', 'updatedAt'],
  ['events', 'lastSyncedAt'],
  ['events', 'createdAt'],
  ['events', 'updatedAt'],
  ['event_segments', 'createdAt'],
  ['event_segments', 'updatedAt'],
  ['figure_instances', 'createdAt'],
  ['figure_instances', 'updatedAt'],
  ['instance_nodes', 'createdAt'],
  ['figure_nodes', 'createdAt'],
  ['figure_nodes', 'updatedAt'],
  ['figure_templates', 'createdAt'],
  ['figure_templates', 'updatedAt'],
  ['rengles', 'createdAt'],
  ['node_assignments', 'createdAt'],
  ['node_assignments', 'updatedAt'],
  ['persons', 'lastSyncedAt'],
  ['persons', 'createdAt'],
  ['persons', 'updatedAt'],
  ['seasons', 'createdAt'],
  ['seasons', 'updatedAt'],
  ['positions', 'createdAt'],
  ['positions', 'updatedAt'],
  ['users', 'inviteExpiresAt'],
  ['users', 'resetExpiresAt'],
  ['users', 'createdAt'],
  ['users', 'updatedAt'],
];

export class ConvertTimestampsToTimestamptz1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of TIMESTAMP_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamptz USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of TIMESTAMP_COLUMNS.slice().reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamp USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }
  }
}
