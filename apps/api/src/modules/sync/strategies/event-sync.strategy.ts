import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Observable, Subscriber } from 'rxjs';
import { EventType, RehearsalMetadata, PerformanceMetadata } from '@muixer/shared';
import { Event } from '../../event/event.entity';
import { Season } from '../../season/season.entity';
import { LegacyApiClient } from '../legacy-api.client';
import { AttendanceSyncStrategy } from './attendance-sync.strategy';
import { SyncStrategy } from '../interfaces/sync-strategy.interface';
import { SyncEvent } from '../interfaces/sync-event.interface';
import { LegacyAssaig, LegacyAssaigDetail, LegacyActuacio, LegacyActuacioDetail } from '../interfaces/legacy-event.interface';

const SEASON_2024_2025 = {
  name: 'Temporada 2024-2025',
  startDate: new Date('2024-09-01'),
  endDate: new Date('2025-09-05'),
  legacyId: '2025',
};

const SEASON_2025_2026 = {
  name: 'Temporada 2025-2026',
  startDate: new Date('2025-09-06'),
  endDate: new Date('2026-09-05'),
  legacyId: '2026',
};

const SEASON_CUTOFF = new Date('2025-09-06');

@Injectable()
export class EventSyncStrategy implements SyncStrategy {
  private readonly logger = new Logger(EventSyncStrategy.name);
  private isSyncing = false;

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Season)
    private readonly seasonRepository: Repository<Season>,
    private readonly legacyApiClient: LegacyApiClient,
    private readonly attendanceSyncStrategy: AttendanceSyncStrategy,
  ) {}

  execute(): Observable<SyncEvent> {
    return new Observable<SyncEvent>((subscriber) => {
      this.runSync(subscriber).catch((error: Error) => {
        subscriber.next({
          type: 'error',
          entity: 'sync',
          message: `Error fatal: ${error.message}`,
        });
        subscriber.complete();
      });
    });
  }

  private async runSync(subscriber: Subscriber<SyncEvent>): Promise<void> {
    if (this.isSyncing) {
      subscriber.next({ type: 'error', entity: 'sync', message: 'Sincronització ja en curs' });
      subscriber.complete();
      return;
    }

    this.isSyncing = true;
    const counts = { newEvents: 0, updatedEvents: 0, errors: 0 };

    try {
      subscriber.next({ type: 'start', entity: 'event', message: 'Connectant al legacy API...' });

      try {
        await this.legacyApiClient.login();
      } catch (err) {
        subscriber.next({ type: 'error', entity: 'sync', message: `Error de connexió: ${(err as Error).message}` });
        subscriber.complete();
        return;
      }

      // Phase 1: Create static seasons (idempotent)
      const { season2024, season2025 } = await this.createStaticSeasons();
      subscriber.next({ type: 'progress', entity: 'season', message: '2 temporades creades/verificades' });

      // Phase 2: Sync rehearsals
      const assajos = await this.legacyApiClient.getAssajos();
      subscriber.next({ type: 'progress', entity: 'event', message: `${assajos.length} assajos trobats` });

      for (const [i, assaig] of assajos.entries()) {
        try {
          const eventId = this.extractEventId(assaig['0']);
          if (!eventId) {
            subscriber.next({ type: 'error', entity: 'event', message: `Assaig ${i + 1}: no s'ha pogut extreure l'ID` });
            counts.errors++;
            continue;
          }

          const detail = await this.legacyApiClient.getAssaigDetail(eventId);
          const isNew = await this.upsertRehearsalEvent(assaig, detail, eventId, season2024, season2025);
          if (isNew) counts.newEvents++; else counts.updatedEvents++;

          subscriber.next({
            type: 'progress',
            entity: 'event',
            current: i + 1,
            total: assajos.length,
            message: `Assaig ${i + 1}/${assajos.length}: ${this.stripHtml(assaig.descripcio)} (${isNew ? 'nou' : 'actualitzat'})`,
          });
        } catch (err) {
          counts.errors++;
          subscriber.next({ type: 'error', entity: 'event', message: `Assaig ${i + 1}: ${(err as Error).message}` });
        }
      }

      // Phase 3: Sync performances
      const actuacions = await this.legacyApiClient.getActuacions();
      subscriber.next({ type: 'progress', entity: 'event', message: `${actuacions.length} actuacions trobades` });

      for (const [i, actuacio] of actuacions.entries()) {
        try {
          const eventId = this.extractEventId(actuacio['0']);
          if (!eventId) {
            subscriber.next({ type: 'error', entity: 'event', message: `Actuació ${i + 1}: no s'ha pogut extreure l'ID` });
            counts.errors++;
            continue;
          }

          const detail = await this.legacyApiClient.getActuacioDetail(eventId);
          const isNew = await this.upsertPerformanceEvent(actuacio, detail, eventId, season2024, season2025);
          if (isNew) counts.newEvents++; else counts.updatedEvents++;

          subscriber.next({
            type: 'progress',
            entity: 'event',
            current: i + 1,
            total: actuacions.length,
            message: `Actuació ${i + 1}/${actuacions.length}: ${this.stripHtml(actuacio.descripcio)} (${isNew ? 'nova' : 'actualitzada'})`,
          });
        } catch (err) {
          counts.errors++;
          subscriber.next({ type: 'error', entity: 'event', message: `Actuació ${i + 1}: ${(err as Error).message}` });
        }
      }

      // Phase 4: Sync attendance for all legacy events
      const allLegacyEvents = await this.eventRepository.find({ where: { legacyId: Not(IsNull()) } });
      await this.attendanceSyncStrategy.syncAll(subscriber, allLegacyEvents);

      subscriber.next({
        type: 'complete',
        entity: 'event',
        message: `Sincronització completada. Nous: ${counts.newEvents}, Actualitzats: ${counts.updatedEvents}, Errors: ${counts.errors}`,
        detail: { newEvents: counts.newEvents, updatedEvents: counts.updatedEvents, errors: counts.errors },
      });
    } finally {
      this.isSyncing = false;
      subscriber.complete();
    }
  }

  private async createStaticSeasons(): Promise<{ season2024: Season; season2025: Season }> {
    for (const s of [SEASON_2024_2025, SEASON_2025_2026]) {
      await this.seasonRepository.upsert(s, { conflictPaths: ['legacyId'] });
    }

    const season2024 = (await this.seasonRepository.findOne({ where: { legacyId: '2025' } }))!;
    const season2025 = (await this.seasonRepository.findOne({ where: { legacyId: '2026' } }))!;

    return { season2024, season2025 };
  }

  private assignSeason(eventDate: Date, season2024: Season, season2025: Season): Season {
    return eventDate < SEASON_CUTOFF ? season2024 : season2025;
  }

  private async upsertRehearsalEvent(
    assaig: LegacyAssaig,
    detail: LegacyAssaigDetail,
    eventId: string,
    season2024: Season,
    season2025: Season,
  ): Promise<boolean> {
    const date = this.parseDate(assaig.data);
    const title = this.stripHtml(assaig.descripcio || detail.descripcio);
    const metadata: RehearsalMetadata = {
      ...(detail.hora_final ? { endTime: detail.hora_final } : {}),
    };

    const existing = await this.eventRepository.findOne({ where: { legacyId: eventId } });

    if (!existing) {
      const season = this.assignSeason(date, season2024, season2025);
      const event = this.eventRepository.create({
        eventType: EventType.ASSAIG,
        title,
        date,
        startTime: assaig.hora_esdeveniment || null,
        location: this.stripHtml(detail.lloc_esdeveniment) || null,
        information: this.stripHtml(detail.informacio) || null,
        countsForStatistics: true,
        metadata,
        season,
        legacyId: eventId,
        legacyType: 'assaig',
        lastSyncedAt: new Date(),
      });
      await this.eventRepository.save(event);
      return true;
    }

    // Update — never touch countsForStatistics or season
    existing.title = title;
    existing.date = date;
    existing.startTime = assaig.hora_esdeveniment || null;
    existing.location = this.stripHtml(detail.lloc_esdeveniment) || null;
    existing.information = this.stripHtml(detail.informacio) || null;
    existing.metadata = metadata;
    existing.lastSyncedAt = new Date();
    await this.eventRepository.save(existing);
    return false;
  }

  private async upsertPerformanceEvent(
    actuacio: LegacyActuacio,
    detail: LegacyActuacioDetail,
    eventId: string,
    season2024: Season,
    season2025: Season,
  ): Promise<boolean> {
    const date = this.parseDate(actuacio.data);
    const title = this.stripHtml(actuacio.descripcio || detail.descripcio);
    const metadata: PerformanceMetadata = {
      isHome: detail.casa === '1',
      colles: detail.colles ? detail.colles.split(',').map((c) => c.trim()).filter(Boolean) : [],
      hasBus: detail.transport === '1',
    };

    const existing = await this.eventRepository.findOne({ where: { legacyId: eventId } });

    if (!existing) {
      const season = this.assignSeason(date, season2024, season2025);
      const event = this.eventRepository.create({
        eventType: EventType.ACTUACIO,
        title,
        date,
        startTime: actuacio.hora_esdeveniment || null,
        location: this.stripHtml(detail.lloc_esdeveniment) || null,
        information: this.stripHtml(detail.informacio) || null,
        countsForStatistics: true,
        metadata,
        season,
        legacyId: eventId,
        legacyType: 'actuacio',
        lastSyncedAt: new Date(),
      });
      await this.eventRepository.save(event);
      return true;
    }

    existing.title = title;
    existing.date = date;
    existing.startTime = actuacio.hora_esdeveniment || null;
    existing.location = this.stripHtml(detail.lloc_esdeveniment) || null;
    existing.information = this.stripHtml(detail.informacio) || null;
    existing.metadata = metadata;
    existing.lastSyncedAt = new Date();
    await this.eventRepository.save(existing);
    return false;
  }

  extractEventId(html: string): string | null {
    if (!html) return null;
    const match = html.match(/\/llista\/(\d+)/);
    return match ? match[1] : null;
  }

  parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const [day, month, year] = dateStr.split('/');
    return new Date(`${year}-${month}-${day}`);
  }

  stripHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }
}
