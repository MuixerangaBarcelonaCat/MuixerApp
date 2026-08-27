import { IntegrationDb } from './integration-db';

/**
 * Reverts migrations one at a time, from the current head, until `migrationName` itself has
 * been undone. Robust to any migration added after it — a hardcoded revert count silently
 * breaks the moment the migration history grows.
 */
export async function undoMigrationsThrough(
  db: IntegrationDb,
  migrationName: string,
): Promise<void> {
  const maxAttempts = db.dataSource.migrations.length + 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rows: { name: string }[] = await db.dataSource.query(
      `SELECT name FROM typeorm_migrations ORDER BY id DESC LIMIT 1`,
    );
    if (rows.length === 0) {
      throw new Error(
        `Reverted all migrations without finding "${migrationName}" — has it been renamed or removed?`,
      );
    }
    const head = rows[0].name;
    await db.dataSource.undoLastMigration();
    if (head === migrationName) return;
  }
  throw new Error(`Migration "${migrationName}" not reached after ${maxAttempts} reverts.`);
}
