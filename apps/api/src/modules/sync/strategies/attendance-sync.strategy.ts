import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subscriber } from 'rxjs';
import { AttendanceStatus, EventType } from '@muixer/shared';
import { Attendance } from '../../event/attendance.entity';
import { Event } from '../../event/event.entity';
import { Person } from '../../person/person.entity';
import { LegacyApiClient } from '../legacy-api.client';
import { SyncEvent } from '../interfaces/sync-event.interface';
import { LegacyAttendance } from '../interfaces/legacy-event.interface';

interface PersonLookupMaps {
  byAlias: Map<string, Person>;
  byFullName: Map<string, Person>;
  byNameSurname: Map<string, Person>;
  byLegacyId: Map<string, Person>;
}

@Injectable()
export class AttendanceSyncStrategy {
  private readonly logger = new Logger(AttendanceSyncStrategy.name);

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    private readonly legacyApiClient: LegacyApiClient,
  ) {}

  executeSingleEvent(eventId: string): Observable<SyncEvent> {
    return new Observable<SyncEvent>((subscriber) => {
      this.runSingleEventSync(subscriber, eventId).catch((error: Error) => {
        subscriber.next({
          type: 'error',
          entity: 'attendance',
          message: `Error fatal: ${error.message}`,
        });
        subscriber.complete();
      });
    });
  }

  private async runSingleEventSync(subscriber: Subscriber<SyncEvent>, eventId: string): Promise<void> {
    try {
      const event = await this.eventRepository.findOne({ where: { id: eventId } });
      if (!event) {
        subscriber.next({ type: 'error', entity: 'attendance', message: 'Esdeveniment no trobat' });
        subscriber.complete();
        return;
      }

      if (!event.legacyId) {
        subscriber.next({ type: 'error', entity: 'attendance', message: 'Esdeveniment sense legacyId, no es pot sincronitzar' });
        subscriber.complete();
        return;
      }

      subscriber.next({ type: 'start', entity: 'attendance', message: `Sincronitzant assistència de "${event.title}"...` });

      try {
        await this.legacyApiClient.login();
      } catch (err) {
        subscriber.next({ type: 'error', entity: 'attendance', message: `Error de connexió: ${(err as Error).message}` });
        subscriber.complete();
        return;
      }

      const maps = await this.buildPersonLookupMaps();
      const { matched, unmatched } = await this.syncEventAttendance(subscriber, event, maps);

      subscriber.next({
        type: 'complete',
        entity: 'attendance',
        message: `Assistència sincronitzada per "${event.title}". Registres: ${matched}, Sense match: ${unmatched}`,
        detail: { matched, unmatched },
      });
    } finally {
      subscriber.complete();
    }
  }

  async syncAll(subscriber: Subscriber<SyncEvent>, events: Event[]): Promise<void> {
    subscriber.next({
      type: 'progress',
      entity: 'attendance',
      message: `Sincronitzant assistència de ${events.length} esdeveniments...`,
    });

    const maps = await this.buildPersonLookupMaps();
    let totalMatched = 0;
    let totalUnmatched = 0;

    for (const [i, event] of events.entries()) {
      try {
        const { matched, unmatched } = await this.syncEventAttendance(subscriber, event, maps);
        totalMatched += matched;
        totalUnmatched += unmatched;

        const msg = unmatched > 0
          ? `${event.title}: ${matched} registres, ${unmatched} sense match`
          : `${event.title}: ${matched} registres`;

        subscriber.next({
          type: 'progress',
          entity: 'attendance',
          current: i + 1,
          total: events.length,
          message: msg,
          ...(unmatched > 0 ? { detail: { unmatched } } : {}),
        });
      } catch (err) {
        subscriber.next({
          type: 'error',
          entity: 'attendance',
          message: `Error sincronitzant assistència de "${event.title}": ${(err as Error).message}`,
        });
      }
    }

    subscriber.next({
      type: 'progress',
      entity: 'attendance',
      message: `Assistència sincronitzada. Registres: ${totalMatched}, Sense match: ${totalUnmatched}`,
      detail: { matched: totalMatched, unmatched: totalUnmatched },
    });
  }

  private async syncEventAttendance(
    subscriber: Subscriber<SyncEvent>,
    event: Event,
    maps: PersonLookupMaps,
  ): Promise<{ matched: number; unmatched: number }> {
    const rows = await this.legacyApiClient.getAssistencies(event.legacyId!);
    const isPast = this.isEventPast(event);
    let matched = 0;
    let unmatched = 0;

    for (const row of rows) {
      try {
        const person = this.matchPerson(row, maps);
        if (!person) {
          unmatched++;
          continue;
        }

        const status = this.mapAttendanceStatus(row.estat, event.eventType, isPast);
        const respondedAt = this.parseTimestamp(row.instant);

        await this.attendanceRepository.upsert(
          {
            person: { id: person.id },
            event: { id: event.id },
            status,
            respondedAt,
            notes: row.observacions || null,
            legacyId: row.id_assistencia || null,
            lastSyncedAt: new Date(),
          },
          { conflictPaths: ['person', 'event'] },
        );

        matched++;
      } catch (err) {
        unmatched++;
        this.logger.warn(`Attendance row error for event ${event.id}: ${(err as Error).message}`);
      }
    }

    await this.recalculateSummary(event.id);
    return { matched, unmatched };
  }

  mapAttendanceStatus(
    legacyEstat: string,
    eventType: EventType,
    isPastEvent: boolean,
  ): AttendanceStatus {
    const estat = legacyEstat?.trim();

    if (eventType === EventType.ASSAIG) {
      if (isPastEvent) {
        if (estat === 'Vinc') return AttendanceStatus.ASSISTIT;
        if (estat === 'Potser') return AttendanceStatus.NO_PRESENTAT;
        if (estat === 'No vinc') return AttendanceStatus.NO_VAIG;
        return AttendanceStatus.PENDENT;
      } else {
        if (estat === 'Potser') return AttendanceStatus.ANIRE;
        if (estat === 'No vinc') return AttendanceStatus.NO_VAIG;
        return AttendanceStatus.PENDENT;
      }
    }

    if (eventType === EventType.ACTUACIO) {
      if (isPastEvent) {
        if (estat === 'Vinc') return AttendanceStatus.ASSISTIT;
        if (estat === 'No vinc') return AttendanceStatus.NO_VAIG;
        return AttendanceStatus.PENDENT;
      } else {
        if (estat === 'Vinc') return AttendanceStatus.ANIRE;
        if (estat === 'No vinc') return AttendanceStatus.NO_VAIG;
        return AttendanceStatus.PENDENT;
      }
    }

    return AttendanceStatus.PENDENT;
  }

  private async buildPersonLookupMaps(): Promise<PersonLookupMaps> {
    const allPersons = await this.personRepository.find();
    const maps: PersonLookupMaps = {
      byAlias: new Map(),
      byFullName: new Map(),
      byNameSurname: new Map(),
      byLegacyId: new Map(),
    };

    for (const person of allPersons) {
      if (person.alias) {
        maps.byAlias.set(person.alias.toUpperCase().trim(), person);
      }

      const fullName = [person.name, person.firstSurname, person.secondSurname]
        .filter(Boolean)
        .join(' ')
        .toUpperCase()
        .trim();
      if (fullName) {
        maps.byFullName.set(fullName, person);
      }

      const nameSurname = [person.name, person.firstSurname]
        .filter(Boolean)
        .join(' ')
        .toUpperCase()
        .trim();
      if (nameSurname) {
        maps.byNameSurname.set(nameSurname, person);
      }

      if (person.legacyId) {
        maps.byLegacyId.set(person.legacyId, person);
      }
    }

    this.logger.log(
      `Person lookup maps built: ${allPersons.length} persons, ` +
      `${maps.byAlias.size} aliases, ${maps.byFullName.size} full names, ` +
      `${maps.byNameSurname.size} name+surname, ${maps.byLegacyId.size} legacyIds`,
    );

    return maps;
  }

  private matchPerson(row: LegacyAttendance, maps: PersonLookupMaps): Person | null {
    const rawName = this.stripHtml(row.nom_casteller || '').toUpperCase().trim();

    if (rawName) {
      const byAlias = maps.byAlias.get(rawName);
      if (byAlias) return byAlias;

      const byFullName = maps.byFullName.get(rawName);
      if (byFullName) return byFullName;

      const byNameSurname = maps.byNameSurname.get(rawName);
      if (byNameSurname) return byNameSurname;
    }

    const legacyPersonId = this.extractPersonId(row['0']);
    if (legacyPersonId) {
      const byLegacyId = maps.byLegacyId.get(legacyPersonId);
      if (byLegacyId) return byLegacyId;
    }

    this.logger.warn(`No person match for attendance: "${rawName}" (legacyPersonId: ${legacyPersonId ?? 'none'})`);
    return null;
  }

  private extractPersonId(html: string): string | null {
    if (!html) return null;
    const match = html.match(/\/casteller\/(\d+)/);
    return match ? match[1] : null;
  }

  private isEventPast(event: Event): boolean {
    const dateStr = event.date instanceof Date
      ? event.date.toISOString().split('T')[0]
      : String(event.date);

    const timeStr = event.startTime || '23:59';
    const eventDateTime = new Date(`${dateStr}T${timeStr}:00`);
    return eventDateTime < new Date();
  }

  parseTimestamp(timestamp: string): Date | null {
    if (!timestamp) return null;
    const match = timestamp.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, day, month, year, hours, minutes, seconds] = match;
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
  }

  private async recalculateSummary(eventId: string): Promise<void> {
    const attendances = await this.attendanceRepository.find({
      where: { event: { id: eventId } },
      relations: ['person'],
    });

    const summary = {
      confirmed: attendances.filter((a) => a.status === AttendanceStatus.ANIRE).length,
      declined: attendances.filter((a) => a.status === AttendanceStatus.NO_VAIG).length,
      pending: attendances.filter((a) => a.status === AttendanceStatus.PENDENT).length,
      attended: attendances.filter((a) => a.status === AttendanceStatus.ASSISTIT).length,
      noShow: attendances.filter((a) => a.status === AttendanceStatus.NO_PRESENTAT).length,
      children: attendances.filter(
        (a) =>
          [AttendanceStatus.ANIRE, AttendanceStatus.ASSISTIT].includes(a.status) &&
          a.person.isXicalla,
      ).length,
      total: attendances.length,
    };

    await this.eventRepository.update(eventId, { attendanceSummary: summary });
  }

  private stripHtml(text: string): string {
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
