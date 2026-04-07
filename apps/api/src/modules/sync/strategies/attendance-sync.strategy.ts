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
import { XlsxAttendanceRow } from '../interfaces/legacy-event.interface';

const LATE_CANCEL_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours in ms

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

      const legacyIdMap = await this.buildLegacyIdMap();
      const { matched, unmatched, lateCancel } = await this.syncEventAttendance(subscriber, event, legacyIdMap);

      subscriber.next({
        type: 'complete',
        entity: 'attendance',
        message: `Assistència sincronitzada per "${event.title}". Registres: ${matched}, Baixes tardanes: ${lateCancel}, Sense match: ${unmatched}`,
        detail: { matched, unmatched, lateCancel },
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

    const legacyIdMap = await this.buildLegacyIdMap();
    let totalMatched = 0;
    let totalUnmatched = 0;
    let totalLateCancel = 0;

    for (const [i, event] of events.entries()) {
      try {
        const { matched, unmatched, lateCancel } = await this.syncEventAttendance(subscriber, event, legacyIdMap);
        totalMatched += matched;
        totalUnmatched += unmatched;
        totalLateCancel += lateCancel;

        const parts = [`${event.title}: ${matched} registres`];
        if (lateCancel > 0) parts.push(`${lateCancel} baixes tardanes`);
        if (unmatched > 0) parts.push(`${unmatched} sense match`);

        subscriber.next({
          type: 'progress',
          entity: 'attendance',
          current: i + 1,
          total: events.length,
          message: parts.join(', '),
          ...(unmatched > 0 || lateCancel > 0 ? { detail: { unmatched, lateCancel } } : {}),
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
      message: `Assistència sincronitzada. Registres: ${totalMatched}, Baixes tardanes: ${totalLateCancel}, Sense match: ${totalUnmatched}`,
      detail: { matched: totalMatched, unmatched: totalUnmatched, lateCancel: totalLateCancel },
    });
  }

  private async syncEventAttendance(
    subscriber: Subscriber<SyncEvent>,
    event: Event,
    legacyIdMap: Map<string, Person>,
  ): Promise<{ matched: number; unmatched: number; lateCancel: number }> {
    const rows = await this.legacyApiClient.getAssistenciesXlsx(event.legacyId!);
    const isPast = this.isEventPast(event);
    let matched = 0;
    let unmatched = 0;

    for (const row of rows) {
      try {
        const person = legacyIdMap.get(row.legacyPersonId);
        if (!person) {
          unmatched++;
          this.logger.warn(`No person match for legacyPersonId=${row.legacyPersonId} (${row.personLabel})`);
          continue;
        }

        const respondedAt = this.parseTimestamp(row.instant);
        const status = this.mapAttendanceStatus(row.estat, event.eventType, isPast);

        await this.attendanceRepository.upsert(
          {
            person: { id: person.id },
            event: { id: event.id },
            status,
            respondedAt,
            // notes: only set on CREATE — never overwrite user-edited notes on re-sync
            lastSyncedAt: new Date(),
          },
          {
            conflictPaths: ['person', 'event'],
            skipUpdateIfNoValuesChanged: false,
          },
        );

        matched++;
      } catch (err) {
        unmatched++;
        this.logger.warn(`Attendance row error for event ${event.id}: ${(err as Error).message}`);
      }
    }

    await this.updateNotesOnCreate(event.id, rows, legacyIdMap);
    const lateCancel = await this.recalculateSummary(event);
    return { matched, unmatched, lateCancel };
  }

  /**
   * Sets notes only for newly created attendance records (no existing notes).
   * Preserves user-edited notes on re-sync per spec §5.9.
   */
  private async updateNotesOnCreate(
    eventId: string,
    rows: XlsxAttendanceRow[],
    legacyIdMap: Map<string, Person>,
  ): Promise<void> {
    const rowsWithNotes = rows.filter((r) => r.notes);
    if (rowsWithNotes.length === 0) return;

    for (const row of rowsWithNotes) {
      const person = legacyIdMap.get(row.legacyPersonId);
      if (!person) continue;

      await this.attendanceRepository
        .createQueryBuilder()
        .update(Attendance)
        .set({ notes: row.notes })
        .where('"personId" = :personId AND "eventId" = :eventId AND notes IS NULL', {
          personId: person.id,
          eventId,
        })
        .execute();
    }
  }

  mapAttendanceStatus(
    estat: XlsxAttendanceRow['estat'],
    eventType: EventType,
    isPastEvent: boolean,
  ): AttendanceStatus {
    if (eventType === EventType.ASSAIG) {
      if (isPastEvent) {
        if (estat === 'Vinc') return AttendanceStatus.ASSISTIT;
        if (estat === 'Potser') return AttendanceStatus.NO_PRESENTAT;
        if (estat === 'No vinc') return AttendanceStatus.NO_VAIG;
        return AttendanceStatus.PENDENT; // null = sense resposta
      } else {
        if (estat === 'Vinc') return AttendanceStatus.ANIRE;
        if (estat === 'Potser') return AttendanceStatus.ANIRE;
        if (estat === 'No vinc') return AttendanceStatus.NO_VAIG;
        return AttendanceStatus.PENDENT; // null = sense resposta
      }
    }

    if (eventType === EventType.ACTUACIO) {
      if (isPastEvent) {
        if (estat === 'Vinc') return AttendanceStatus.ASSISTIT;
        if (estat === 'No vinc') return AttendanceStatus.NO_VAIG;
        if (estat === 'Potser') return AttendanceStatus.NO_PRESENTAT;
        return AttendanceStatus.PENDENT;
      } else {
        if (estat === 'Vinc') return AttendanceStatus.ANIRE;
        if (estat === 'No vinc') return AttendanceStatus.NO_VAIG;
        if (estat === 'Potser') return AttendanceStatus.ANIRE;
        return AttendanceStatus.PENDENT;
      }
    }

    return AttendanceStatus.PENDENT;
  }

  computeIsLateCancel(respondedAt: Date | null, eventStartMs: number | null): boolean {
    if (!respondedAt || !eventStartMs) return false;
    const respondedMs = respondedAt.getTime();
    return respondedMs >= eventStartMs - LATE_CANCEL_WINDOW_MS && respondedMs <= eventStartMs;
  }

  private async buildLegacyIdMap(): Promise<Map<string, Person>> {
    const allPersons = await this.personRepository.find();
    const map = new Map<string, Person>();

    for (const person of allPersons) {
      if (person.legacyId) {
        map.set(person.legacyId, person);
      }
    }

    this.logger.log(`Legacy ID map built: ${map.size} persons with legacyId (of ${allPersons.length} total)`);
    return map;
  }

  private getEventStartMs(event: Event): number | null {
    const dateStr = event.date instanceof Date
      ? event.date.toISOString().split('T')[0]
      : String(event.date);

    const timeStr = event.startTime || '23:59';
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    return isNaN(dt.getTime()) ? null : dt.getTime();
  }

  private isEventPast(event: Event): boolean {
    const startMs = this.getEventStartMs(event);
    return startMs !== null ? startMs < Date.now() : false;
  }

  parseTimestamp(timestamp: string | null): Date | null {
    if (!timestamp) return null;
    const match = timestamp.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, day, month, year, hours, minutes, seconds] = match;
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
  }

  private async recalculateSummary(event: Event): Promise<number> {
    const attendances = await this.attendanceRepository.find({
      where: { event: { id: event.id } },
      relations: ['person'],
    });

    const eventStartMs = this.getEventStartMs(event);
    const lateCancel = attendances.filter(
      (a) => a.status === AttendanceStatus.NO_VAIG && this.computeIsLateCancel(a.respondedAt, eventStartMs),
    ).length;

    const summary = {
      confirmed: attendances.filter((a) => a.status === AttendanceStatus.ANIRE).length,
      declined: attendances.filter((a) => a.status === AttendanceStatus.NO_VAIG).length,
      pending: attendances.filter((a) => a.status === AttendanceStatus.PENDENT).length,
      attended: attendances.filter((a) => a.status === AttendanceStatus.ASSISTIT).length,
      noShow: attendances.filter((a) => a.status === AttendanceStatus.NO_PRESENTAT).length,
      lateCancel,
      children: attendances.filter(
        (a) =>
          [AttendanceStatus.ANIRE, AttendanceStatus.ASSISTIT].includes(a.status) &&
          a.person.isXicalla,
      ).length,
      total: attendances.length,
    };

    await this.eventRepository.update(event.id, { attendanceSummary: summary });
    return lateCancel;
  }
}
