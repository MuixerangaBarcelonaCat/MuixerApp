import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { AppModule } from '../../../app/app.module';
import { Season } from '../../season/season.entity';
import { Event } from '../../event/event.entity';

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
  const eventRepo = app.get<Repository<Event>>(getRepositoryToken(Event));

  const seedPath = path.join(process.cwd(), 'data/seeds/seasons.json');

  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`);
    process.exit(1);
  }

  const seeds: SeasonSeed[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  console.log(`\n=== FASE 1: Importació de temporades ===\n`);
  console.log(`Importació de ${seeds.length} temporada(es) des de ${seedPath}...\n`);

  for (const s of seeds) {
    await seasonRepo.upsert(
      {
        name: s.name,
        startDate: new Date(s.startDate),
        endDate: new Date(s.endDate),
        description: s.description,
        legacyId: s.legacyId,
      },
      { conflictPaths: ['legacyId'] },
    );
    console.log(`  [OK] ${s.name} (legacyId: ${s.legacyId})`);
  }

  console.log(`\n=== FASE 2: Reassignació d'events a temporades ===\n`);

  const seasons = await seasonRepo.find({ order: { startDate: 'ASC' } });
  console.log(`Temporades a la base de dades: ${seasons.length}`);
  for (const season of seasons) {
    const startStr = new Date(season.startDate).toISOString().split('T')[0];
    const endStr = new Date(season.endDate).toISOString().split('T')[0];
    console.log(`  - ${season.name}: ${startStr} → ${endStr} (ID: ${season.id})`);
  }

  let updatedCount = 0;
  let skippedCount = 0;

  for (const season of seasons) {
    const eventsInRange = await eventRepo.find({
      where: {
        date: Between(season.startDate, season.endDate),
      },
      relations: ['season'],
    });

    for (const event of eventsInRange) {
      if (event.season?.id !== season.id) {
        const oldSeasonId = event.season?.id ?? 'NULL';
        const eventDateStr = new Date(event.date).toISOString().split('T')[0];
        await eventRepo.update(event.id, { season: { id: season.id } });
        updatedCount++;
        console.log(`  [ACTUALITZAT] "${event.title}" (${eventDateStr}): ${oldSeasonId} → ${season.id}`);
      } else {
        skippedCount++;
      }
    }
  }

  const orphanEvents = await eventRepo.find({
    where: { season: IsNull() },
    order: { date: 'ASC' },
  });

  if (orphanEvents.length > 0) {
    console.log(`\n⚠️  ${orphanEvents.length} event(s) sense temporada assignada:`);
    for (const event of orphanEvents) {
      const closestSeason = findClosestSeason(event.date, seasons);
      const eventDateStr = new Date(event.date).toISOString().split('T')[0];
      if (closestSeason) {
        await eventRepo.update(event.id, { season: { id: closestSeason.id } });
        updatedCount++;
        console.log(`  [ASSIGNAT] "${event.title}" (${eventDateStr}) → ${closestSeason.name}`);
      } else {
        console.log(`  [SENSE TEMPORADA] "${event.title}" (${eventDateStr})`);
      }
    }
  }

  console.log(`\n=== Resum ===`);
  console.log(`  Temporades importades: ${seeds.length}`);
  console.log(`  Events actualitzats: ${updatedCount}`);
  console.log(`  Events ja correctes: ${skippedCount}`);
  console.log(`\nDone!\n`);

  await app.close();
}

function findClosestSeason(eventDate: Date | string, seasons: Season[]): Season | null {
  if (seasons.length === 0) return null;

  const date = new Date(eventDate);
  const match = seasons.find((s) => {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    return date >= start && date <= end;
  });

  if (match) return match;

  return seasons[seasons.length - 1];
}

bootstrap().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
