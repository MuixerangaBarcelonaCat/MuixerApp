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

/**
 * Estratègia de sincronització d'assistència des del legacy APPsistència.
 * Font de dades: fitxers XLSX (GET /assistencia-export/{id}) — no el JSON de /api/assistencies,
 * perquè el XLSX inclou totes les persones (incloent les que no han respost i els "No vinc").
 * Mapeja l'estat `Vinc/Potser/No vinc/null` al AttendanceStatus en funció de si l'event és futur o passat.
 */
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

  /** Sincronitza l'assistència d'un sol event per UUID. Fa login al legacy, descarrega el XLSX i fa upsert dels registres. */
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
    const syncTimestamp = new Date();

    // Use Map to deduplicate by personId (last entry wins — most recent response)
    const attendanceMap = new Map<
      string,
      {
        person: { id: string };
        event: { id: string };
        status: AttendanceStatus;
        respondedAt: Date | null;
        lastSyncedAt: Date;
      }
    >();

    let unmatched = 0;

    for (const row of rows) {
      const person = legacyIdMap.get(row.legacyPersonId);
      if (!person) {
        unmatched++;
        this.logger.warn(`No person match for legacyPersonId=${row.legacyPersonId} (${row.personLabel})`);
        continue;
      }

      const respondedAt = this.parseTimestamp(row.instant);
      const status = this.mapAttendanceStatus(row.estat, event.eventType, isPast);

      // Overwrites if duplicate — last entry wins
      attendanceMap.set(person.id, {
        person: { id: person.id },
        event: { id: event.id },
        status,
        respondedAt,
        lastSyncedAt: syncTimestamp,
      });
    }

    const attendanceBatch = Array.from(attendanceMap.values());

    // Batch upsert all attendances in one query
    if (attendanceBatch.length > 0) {
      await this.attendanceRepository.upsert(attendanceBatch, {
        conflictPaths: ['person', 'event'],
        skipUpdateIfNoValuesChanged: false,
      });
    }

    const matched = attendanceBatch.length;
    await this.updateNotesOnCreate(event.id, rows, legacyIdMap);
    const lateCancel = await this.recalculateSummary(event);
    return { matched, unmatched, lateCancel };
  }

  /**
   * Sets notes only for newly created attendance records (no existing notes).
   * Preserves user-edited notes on re-sync per spec §5.9.
   * Uses batch update with CASE expression for efficiency.
   */
  private async updateNotesOnCreate(
    eventId: string,
    rows: XlsxAttendanceRow[],
    legacyIdMap: Map<string, Person>,
  ): Promise<void> {
    const rowsWithNotes = rows.filter((r) => r.notes);
    if (rowsWithNotes.length === 0) return;

    // Build person-to-notes map for valid rows
    const notesMap = new Map<string, string>();
    for (const row of rowsWithNotes) {
      const person = legacyIdMap.get(row.legacyPersonId);
      if (person && row.notes) {
        notesMap.set(person.id, row.notes);
      }
    }

    if (notesMap.size === 0) return;

    // Single batch update using CASE WHEN for all notes
    const personIds = Array.from(notesMap.keys());
    let caseClause = 'CASE "personId"';
    const params: Record<string, string> = { eventId };

    personIds.forEach((personId, i) => {
      caseClause += ` WHEN :pid${i} THEN :note${i}`;
      params[`pid${i}`] = personId;
      params[`note${i}`] = notesMap.get(personId)!;
    });
    caseClause += ' END';

    await this.attendanceRepository
      .createQueryBuilder()
      .update(Attendance)
      .set({ notes: () => caseClause })
      .where('"eventId" = :eventId AND "personId" IN (:...personIds) AND notes IS NULL', {
        ...params,
        personIds,
      })
      .execute();
  }

  /**
   * Normalizes raw XLSX estat values into a canonical form.
   * Handles transport variants: 'Vinc amb autocar', 'Vinc amb cotxe' → 'Vinc'
   */
  private normalizeEstat(estat: string | null): 'Vinc' | 'No vinc' | 'Potser' | null {
    if (!estat) return null;
    if (estat.startsWith('Vinc')) return 'Vinc';
    if (estat === 'No vinc') return 'No vinc';
    if (estat === 'Potser') return 'Potser';
    this.logger.warn(`Unknown estat value: "${estat}", treating as null`);
    return null;
  }

  mapAttendanceStatus(
    estat: XlsxAttendanceRow['estat'],
    eventType: EventType,
    isPastEvent: boolean,
  ): AttendanceStatus {
    const normalized = this.normalizeEstat(estat);

    if (eventType === EventType.ASSAIG) {
      if (isPastEvent) {
        if (normalized === 'Vinc') return AttendanceStatus.ASSISTIT;
        if (normalized === 'Potser') return AttendanceStatus.NO_PRESENTAT;
        if (normalized === 'No vinc') return AttendanceStatus.NO_VAIG;
        return AttendanceStatus.PENDENT;
      } else {
        if (normalized === 'Vinc') return AttendanceStatus.ANIRE;
        if (normalized === 'Potser') return AttendanceStatus.ANIRE;
        if (normalized === 'No vinc') return AttendanceStatus.NO_VAIG;
        return AttendanceStatus.PENDENT;
      }
    }

    if (eventType === EventType.ACTUACIO) {
      if (isPastEvent) {
        if (normalized === 'Vinc') return AttendanceStatus.ASSISTIT;
        if (normalized === 'No vinc') return AttendanceStatus.NO_VAIG;
        if (normalized === 'Potser') return AttendanceStatus.NO_PRESENTAT;
        return AttendanceStatus.PENDENT;
      } else {
        if (normalized === 'Vinc') return AttendanceStatus.ANIRE;
        if (normalized === 'No vinc') return AttendanceStatus.NO_VAIG;
        if (normalized === 'Potser') return AttendanceStatus.ANIRE;
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
