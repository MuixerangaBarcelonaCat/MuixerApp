/**
 * Reset all figure-related data from the database.
 *
 * Truncates tables in FK-safe order:
 *   node_assignments → instance_nodes → figure_instances →
 *   figure_nodes → composition_slots → figure_templates →
 *   composition_templates
 *
 * Usage:
 *   nx run api:reset-figure-data
 */

import 'reflect-metadata';

async function run(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { getDataSourceToken } = await import('@nestjs/typeorm');
  const { AppModule } = await import('../../../app/app.module');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(getDataSourceToken());

    const tables = [
      'node_assignments',
      'instance_nodes',
      'figure_instances',
      'figure_nodes',
      'composition_slots',
      'figure_templates',
      'composition_templates',
    ];

    console.log('\nResetting figure data...\n');

    for (const table of tables) {
      await dataSource.query(`DELETE FROM "${table}"`);
      console.log(`  Cleared: ${table}`);
    }

    console.log('\nDone. All figure data has been removed.\n');
    console.log('Run seed scripts to re-populate:\n');
    console.log('  nx run api:seed-figures-pd3-insert');
    console.log('  nx run api:seed-figures-pd3-creu-insert');
    console.log('  nx run api:seed-figures-pd4-insert\n');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
