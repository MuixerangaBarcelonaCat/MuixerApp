import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { AppModule } from '../../../app/app.module';
import { Season } from '../../season/season.entity';

interface SeasonSeed {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description: string | null;
  legacyId: string | null;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const seasonRepo = app.get<Repository<Season>>(getRepositoryToken(Season));

  const seedPath = path.join(process.cwd(), 'data/seeds/seasons.json');

  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`);
    process.exit(1);
  }

  const seeds: SeasonSeed[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  console.log(`\nImporting ${seeds.length} season(s) from ${seedPath}...\n`);

  for (const s of seeds) {
    await seasonRepo.upsert(
      {
        id: s.id,
        name: s.name,
        startDate: new Date(s.startDate),
        endDate: new Date(s.endDate),
        description: s.description,
        legacyId: s.legacyId,
      },
      { conflictPaths: ['id'] },
    );
    console.log(`  [OK] ${s.name} (${s.id})`);
  }

  console.log(`\nDone — ${seeds.length} temporades importades.\n`);

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
