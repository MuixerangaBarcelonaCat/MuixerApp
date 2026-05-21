/**
 * Migration: normalize TRONC node coordinates to relative units.
 *
 * Before this migration, TRONC nodes had pixel-like placeholder values
 * (x:0, width:60). After migration, x and width are relative tronc units
 * (1u = 1 person width) matching the TroncViewComponent rendering system.
 *
 * BASE nodes are intentionally left unchanged: their x/y/width values are
 * pixel coordinates used by the pinya Konva canvas and must not be altered.
 *
 * Safe to run multiple times (idempotent: only affects width=60 or large values
 * for TRONC zone nodes).
 *
 * Usage:
 *   nx run api:migrate-tronc-units
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

    console.log('\nMigrating TRONC node coordinates to relative units...\n');

    const figureNodesResult = await dataSource.query(`
      UPDATE figure_nodes
      SET width = 1, x = 0
      WHERE zone = 'TRONC'
    `);
    console.log(`  figure_nodes updated: ${figureNodesResult[1] ?? 0} rows`);

    const instanceNodesResult = await dataSource.query(`
      UPDATE instance_nodes
      SET width = 1, x = 0
      WHERE zone = 'TRONC'
    `);
    console.log(`  instance_nodes updated: ${instanceNodesResult[1] ?? 0} rows`);

    console.log('\nDone. TRONC nodes now use relative units (x=0, width=1).\n');
    console.log('Use the TroncViewComponent editor to set correct x and width per figure.\n');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
