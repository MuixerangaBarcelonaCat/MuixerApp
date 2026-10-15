import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AttendanceStatus,
  AttendanceSummary,
  AuditAction,
  ResolvedAttendanceStatus,
  TagCategory,
} from '@muixer/shared';
import { isPastLockWindow } from '../../common/utils/lock.util';
import {
  eventDateOnly,
  personExistedAtEventSql,
  personPendingAtEventSql,
  resolveAttendanceStatus,
} from '../../common/utils/attendance-status.util';
import { AuditService } from '../audit/audit.service';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';
import { Person } from '../person/person.entity';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

/**
 * Sort key for the attendance list: accent/case-insensitive and with the provisional
 * "~" alias prefix stripped, so provisional persons interleave alphabetically
 * instead of collapsing to the end of the last page.
 */
const NORMALIZED_ALIAS_EXPR = "unaccent(lower(regexp_replace(person.alias, '^~', '')))";

/**
 * Pending count per event: every person (active or not) who existed on the event day and has no
 * answer — no row, or a PENDENT row. Computed live because creating a person changes it.
 */
const PENDING_COUNT_SQL = `
  SELECT e.id AS "eventId", COUNT(p.id)::int AS "pending"
    FROM events e
    JOIN persons p ON ${personPendingAtEventSql('p', 'e')}
   WHERE e.id = ANY($1)
   GROUP BY e.id`;

/** A person loaded for the attendance list, with this event's row (if any) mapped onto it. */
type PersonWithAttendance = Person & { attendance: Attendance | null };

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /** Retorna una llista paginada d'assistències per a un event concret amb filtres per estat i cerca de persona. */
  async findByEvent(
    eventId: string,
    filters: AttendanceFilterDto,
  ): Promise<{ data: AttendanceItem[]; total: number }> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const { status, search, positionIds, page = 1, limit = 100 } = filters;

    // Every person is listed except NO_REGISTRAT ones: no answer and created after the event day.
    const qb = this.personRepository
      .createQueryBuilder('person')
      .leftJoinAndSelect('person.positions', 'position')
      .leftJoinAndMapOne(
        'person.attendance',
        Attendance,
        'attendance',
        'attendance."personId" = person.id AND attendance."eventId" = :eventId',
        { eventId },
      )
      .where(
        `((attendance.id IS NOT NULL AND attendance.status <> :pendent) OR ${personExistedAtEventSql('person', 'CAST(:eventDate AS date)')})`,
        { pendent: AttendanceStatus.PENDENT, eventDate: eventDateOnly(event.date) },
      );

    if (status === AttendanceStatus.PENDENT) {
      qb.andWhere('(attendance.id IS NULL OR attendance.status = :pendent)');
    } else if (status) {
      qb.andWhere('attendance.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(unaccent(person.alias) ILIKE unaccent(:search) OR unaccent(person.name) ILIKE unaccent(:search) OR unaccent(person.firstSurname) ILIKE unaccent(:search))',
        { search: `%${search}%` },
      );
    }

    if (positionIds && positionIds.length > 0) {
      qb.andWhere((subQb) => {
        const subQuery = subQb
          .subQuery()
          .select('sub_person.id')
          .from(Person, 'sub_person')
          .innerJoin('sub_person.positions', 'sub_position')
          .where('sub_position.id IN (:...positionIds)')
          .getQuery();
        return 'person.id IN ' + subQuery;
      });
      qb.setParameter('positionIds', positionIds);
    }

    const total = await qb.getCount();

    // Sort case-insensitively and ignore the provisional "~" prefix, so a
    // provisional person sorts next to a regular one with the same name instead
    // of being pushed to the very end of the list (and off the last page).
    const persons = (await qb
      .addSelect(NORMALIZED_ALIAS_EXPR, 'normalized_alias')
      .orderBy('normalized_alias', 'ASC')
      .addOrderBy('person.alias', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany()) as PersonWithAttendance[];

    return {
      data: persons.map((person) => toAttendanceItem(person, person.attendance ?? null, event.date)),
      total,
    };
  }

  /**
   * Sets a person's attendance to an event. Attendance is a status of (person, event), not an
   * entity: with no row, PENDENT without notes writes nothing (no row ≡ PENDENT); anything else
   * inserts the row. An existing row is updated, and kept when it goes back to PENDENT so
   * `respondedAt` records when. Recalcula el summary de l'event.
   */
  async set(
    eventId: string,
    personId: string,
    dto: UpdateAttendanceDto,
    actorUserId?: string,
  ): Promise<{ attendance: AttendanceItem; summary: AttendanceSummary }> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const person = await this.personRepository.findOne({
      where: { id: personId },
      relations: ['positions'],
    });
    if (!person) {
      throw new NotFoundException(`Person with ID ${personId} not found`);
    }

    const locked = isPastLockWindow(event.date);
    if (locked && !dto.force) {
      throw new ForbiddenException('Este event està fora del marge per canviar assistència.');
    }

    const existing = await this.attendanceRepository.findOne({
      where: { event: { id: eventId }, person: { id: personId } },
    });
    const previousStatus = existing?.status ?? AttendanceStatus.PENDENT;

    let saved: Attendance | null;
    if (existing) {
      // respondedAt marks when the person responded to the attendance request — only a
      // status change is a "response"; editing notes alone must not touch it (see SM-15).
      if (dto.status !== undefined && dto.status !== existing.status) {
        existing.status = dto.status;
        existing.respondedAt = new Date();
      }
      if (dto.notes !== undefined) existing.notes = dto.notes;
      saved = await this.attendanceRepository.save(existing);
    } else {
      const newStatus = dto.status ?? AttendanceStatus.PENDENT;
      const notes = dto.notes ?? null;
      saved =
        newStatus === AttendanceStatus.PENDENT && notes === null
          ? null
          : await this.attendanceRepository.save(
              this.attendanceRepository.create({
                status: newStatus,
                notes,
                respondedAt: newStatus === AttendanceStatus.PENDENT ? null : new Date(),
                event,
                person,
              }),
            );
    }

    if (saved && locked && dto.force) {
      await this.auditService.record({
        actorUserId,
        action: AuditAction.ATTENDANCE_LOCK_OVERRIDE,
        targetType: 'Attendance',
        targetId: saved.id,
        metadata: { eventId, personId, previousStatus, newStatus: saved.status },
      });
    }

    const summary = await this.recalculateSummary(eventId);

    return { attendance: toAttendanceItem(person, saved, event.date), summary };
  }

  /**
   * Recalcula i desa el `attendanceSummary` de l'event: els estats contestats surten de les files
   * d'assistència; `pending` és el recompte viu de `livePendingCounts`. S'executa a cada canvi
   * d'assistència. Bloqueja la fila de l'event (`pessimistic_write`) abans de llegir les
   * assistències, perquè dues recalculacions concurrents del mateix event se serialitzin — sense
   * això, la segona podria sobreescriure el resultat de la primera amb un recompte desactualitzat
   * (llegit abans que la primera confirmés el seu canvi).
   */
  async recalculateSummary(eventId: string): Promise<AttendanceSummary> {
    return this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder(Event, 'event')
        .setLock('pessimistic_write')
        .where('event.id = :eventId', { eventId })
        .getOne();

      const rows = await manager
        .createQueryBuilder(Attendance, 'attendance')
        .innerJoin('attendance.person', 'person')
        .select('attendance.status', 'status')
        .addSelect('person."isXicalla"', 'isXicalla')
        .addSelect('COUNT(*)', 'count')
        .where('attendance."eventId" = :eventId', { eventId })
        .andWhere('attendance.status <> :pendent', { pendent: AttendanceStatus.PENDENT })
        .groupBy('attendance.status')
        .addGroupBy('person."isXicalla"')
        .getRawMany<{ status: AttendanceStatus; isXicalla: boolean; count: string }>();

      const pending = (await this.queryPendingCounts([eventId], manager)).get(eventId) ?? 0;
      const summary = withLivePending(summarizeCounts(rows), pending);

      await manager.update(Event, eventId, { attendanceSummary: summary });

      return summary;
    });
  }

  /**
   * Live pending count per event (0 for events with nobody pending). Stored summaries go stale
   * when a person is created, so read paths lay this over them with `withLivePending`.
   */
  async livePendingCounts(eventIds: string[]): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map();
    return this.queryPendingCounts(eventIds, this.dataSource.manager);
  }

  private async queryPendingCounts(eventIds: string[], manager: EntityManager): Promise<Map<string, number>> {
    const rows: { eventId: string; pending: number }[] = await manager.query(PENDING_COUNT_SQL, [eventIds]);
    const counts = new Map(eventIds.map((id) => [id, 0]));
    for (const row of rows) counts.set(row.eventId, Number(row.pending));
    return counts;
  }
}

/**
 * Replaces a summary's `pending` with the live count and adjusts `total` to match — whatever the
 * stored `pending` held (a stale live count, or PENDENT rows in a summary written by the sync).
 */
export function withLivePending(summary: AttendanceSummary, pending: number): AttendanceSummary {
  return { ...summary, pending, total: summary.total - summary.pending + pending };
}
/** Plega les files de `GROUP BY status, isXicalla` en el `attendanceSummary` de l'event. */
function summarizeCounts(
  rows: { status: AttendanceStatus; isXicalla: boolean; count: string }[],
): AttendanceSummary {
  const summary: AttendanceSummary = {
    confirmed: 0,
    declined: 0,
    pending: 0,
    attended: 0,
    lateCancel: 0,
    children: 0,
    childrenAttended: 0,
    total: 0,
  };

  for (const row of rows) {
    const count = Number(row.count);
    summary.total += count;

    if (row.status === AttendanceStatus.ANIRE) summary.confirmed += count;
    else if (row.status === AttendanceStatus.NO_VAIG) summary.declined += count;
    else if (row.status === AttendanceStatus.PENDENT) summary.pending += count;
    else if (row.status === AttendanceStatus.ASSISTIT) summary.attended += count;

    if (row.isXicalla) {
      if (row.status === AttendanceStatus.ANIRE || row.status === AttendanceStatus.ASSISTIT) {
        summary.children += count;
      }
      if (row.status === AttendanceStatus.ASSISTIT) summary.childrenAttended += count;
    }
  }

  return summary;
}

interface AttendancePersonRef {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  isXicalla: boolean;
  isProvisional: boolean;
  notes: string | null;
  notesEmoji: string | null;
  positions: { id: string; name: string; color: string | null; category: TagCategory }[];
}

/** A person's attendance to an event. No `id`: attendance is keyed by (person, event), with or without a row. */
interface AttendanceItem {
  status: ResolvedAttendanceStatus;
  respondedAt: Date | null;
  notes: string | null;
  person: AttendancePersonRef;
}

function toAttendanceItem(person: Person, attendance: Attendance | null, eventDate: Date | string): AttendanceItem {
  return {
    status: resolveAttendanceStatus(attendance?.status ?? null, person.createdAt, eventDate),
    respondedAt: attendance?.respondedAt ?? null,
    notes: attendance?.notes ?? null,
    person: {
      id: person.id,
      alias: person.alias,
      name: person.name,
      firstSurname: person.firstSurname,
      isXicalla: person.isXicalla,
      isProvisional: person.isProvisional,
      notes: person.notes,
      notesEmoji: person.notesEmoji,
      positions: (person.positions ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        category: p.category,
      })),
    },
  };
}
