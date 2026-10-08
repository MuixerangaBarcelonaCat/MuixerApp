import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { Attendance } from './attendance.entity';
import { Season } from '../season/season.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { SeasonService } from '../season/season.service';
import { AttendanceService, withLivePending } from './attendance.service';
import { EventFilterDto } from './dto/event-filter.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  EVENT_SORT_COLUMN_MAP,
  type EventSortByField,
  type EventSortOrder,
} from './constants/event-sort.constants';
import { SelectQueryBuilder } from 'typeorm';
import { formatDateOnly } from '../../common/utils/date.util';

/** An event with the season its date falls in (mapped by the query, never stored). */
type EventWithSeason = Event & { season?: Season | null };

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(EventSegment)
    private readonly segmentRepository: Repository<EventSegment>,
    private readonly seasonService: SeasonService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /** Retorna una llista paginada d'events (amb la temporada derivada de la data) i filtres per temporada, tipus, rang de dates i text. Suporta el filtre `timeFilter` (upcoming/past). */
  async findAll(filters: EventFilterDto): Promise<{ data: EventListItem[]; total: number }> {
    const {
      seasonId,
      eventType,
      dateFrom,
      dateTo,
      search,
      countsForStatistics,
      sortBy,
      sortOrder,
      timeFilter,
      page = 1,
      limit = 25,
    } = filters;

    // Seasons never overlap (DB exclusion constraint), so this join adds at most one row per event.
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndMapOne('event.season', Season, 'season', 'event.date BETWEEN season.startDate AND season.endDate');

    if (seasonId) {
      qb.andWhere('season.id = :seasonId', { seasonId });
    }

    if (eventType) {
      qb.andWhere('event.eventType = :eventType', { eventType });
    }

    if (timeFilter === 'upcoming') {
      qb.andWhere('event.date >= CURRENT_DATE');
    } else if (timeFilter === 'past') {
      qb.andWhere('event.date < CURRENT_DATE');
    }

    if (dateFrom) {
      qb.andWhere('event.date >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      qb.andWhere('event.date <= :dateTo', { dateTo });
    }

    if (search) {
      qb.andWhere(
        '(unaccent(event.title) ILIKE unaccent(:search) OR unaccent(event.location) ILIKE unaccent(:search))',
        { search: `%${search}%` },
      );
    }

    if (countsForStatistics !== undefined) {
      qb.andWhere('event.countsForStatistics = :countsForStatistics', { countsForStatistics });
    }

    const total = await qb.getCount();

    this.applySort(qb, sortBy, sortOrder);

    const events: EventWithSeason[] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const eventIds = events.map((e) => e.id);
    const [summaryMap] = await Promise.all([
      this.buildSegmentsSummaryMap(eventIds),
      this.applyLivePending(events),
    ]);

    return { data: events.map((e) => toListItem(e, summaryMap.get(e.id) ?? null)), total };
  }

  /** Retorna el detall complet d'un event per ID incloent la temporada derivada de la data. Llança NotFoundException si no existeix. */
  async findOne(id: string): Promise<EventDetailItem> {
    const event = await this.eventRepository.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const season = await this.seasonService.findByDate(formatDateOnly(event.date));
    await this.applyLivePending([event]);
    return toDetailItem(event, season);
  }

  /** Crea un event. La data ha de ser dins d'alguna temporada (BadRequestException si no ho és). */
  async create(dto: CreateEventDto): Promise<EventDetailItem> {
    const season = await this.assertDateInSeason(dto.date);

    const event = this.eventRepository.create({
      title: dto.title,
      eventType: dto.eventType,
      date: new Date(dto.date),
      startTime: dto.startTime ?? null,
      location: dto.location ?? null,
      locationUrl: dto.locationUrl ?? null,
      description: dto.description ?? null,
      information: dto.information ?? null,
      notes: dto.notes ?? null,
      countsForStatistics: dto.countsForStatistics ?? true,
    });

    const saved = await this.eventRepository.save(event);
    // Reload so `date` comes back as the column value (YYYY-MM-DD), as findOne returns it.
    const reloaded = (await this.eventRepository.findOne({ where: { id: saved.id } })) ?? saved;
    await this.applyLivePending([reloaded]);
    return toDetailItem(reloaded, season);
  }

  /**
   * Actualitza parcialment un event. Només modifica els camps explícitament presents al DTO (undefined = no tocar).
   * Una data nova ha de ser dins d'alguna temporada; si la data no canvia no es valida, perquè els events antics
   * sense temporada es puguen continuar editant.
   */
  async update(id: string, dto: UpdateEventDto): Promise<EventDetailItem> {
    const event = await this.eventRepository.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const newDate =
      dto.date !== undefined && formatDateOnly(dto.date) !== formatDateOnly(event.date) ? dto.date : null;
    const season = newDate
      ? await this.assertDateInSeason(newDate)
      : await this.seasonService.findByDate(formatDateOnly(event.date));

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.date !== undefined) event.date = new Date(dto.date);
    if (dto.startTime !== undefined) event.startTime = dto.startTime;
    if (dto.location !== undefined) event.location = dto.location ?? null;
    if (dto.locationUrl !== undefined) event.locationUrl = dto.locationUrl ?? null;
    if (dto.description !== undefined) event.description = dto.description ?? null;
    if (dto.information !== undefined) event.information = dto.information ?? null;
    if (dto.notes !== undefined) event.notes = dto.notes || null;
    if (dto.countsForStatistics !== undefined) event.countsForStatistics = dto.countsForStatistics;

    const saved = await this.eventRepository.save(event);
    await this.applyLivePending([saved]);
    return toDetailItem(saved, season);
  }

  /** The season containing `date`; throws when there is none, since every new or moved event must belong to one. */
  private async assertDateInSeason(date: string): Promise<Season> {
    const season = await this.seasonService.findByDate(formatDateOnly(date));
    if (!season) {
      throw new BadRequestException("La data de l'esdeveniment no és dins de cap temporada.");
    }
    return season;
  }

  /** Elimina un event. Llança ConflictException si l'event té registres d'assistència associats (protecció d'integritat). */
  async remove(id: string): Promise<void> {
    const event = await this.eventRepository.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const attendanceCount = await this.attendanceRepository.count({
      where: { event: { id } },
    });

    if (attendanceCount > 0) {
      throw new ConflictException(
        'No es pot eliminar un event amb registres d\'assistència. Elimina primer els registres.',
      );
    }

    await this.eventRepository.remove(event);
  }

  /**
   * Replaces each event's stored `pending` (and `total`) with the live count: it changes whenever a
   * person is created, which never touches the stored summary. Mutates the loaded entities only.
   */
  private async applyLivePending(events: Event[]): Promise<void> {
    if (events.length === 0) return;
    const counts = await this.attendanceService.livePendingCounts(events.map((e) => e.id));
    for (const event of events) {
      event.attendanceSummary = withLivePending(event.attendanceSummary, counts.get(event.id) ?? 0);
    }
  }

  private async buildSegmentsSummaryMap(
    eventIds: string[],
  ): Promise<Map<string, SegmentsSummary>> {
    if (eventIds.length === 0) return new Map();

    const segments = await this.segmentRepository
      .createQueryBuilder('segment')
      .leftJoinAndSelect('segment.event', 'event')
      .leftJoinAndSelect('segment.instances', 'instance')
      .leftJoinAndSelect('instance.figureTemplate', 'figureTemplate')
      .where('event.id IN (:...eventIds)', { eventIds })
      .orderBy('segment.sortOrder', 'ASC')
      .addOrderBy('instance.sortOrder', 'ASC')
      .getMany();

    const map = new Map<string, SegmentsSummary>();

    for (const segment of segments) {
      const eventId = segment.event?.id;
      if (!eventId) continue;
      if (!map.has(eventId)) {
        map.set(eventId, { segmentCount: 0, instanceCount: 0, segments: [] });
      }
      const summary = map.get(eventId)!;
      summary.segmentCount += 1;

      const figureNames = (segment.instances ?? []).map((i) =>
        i.figureTemplate?.name ?? '',
      );

      summary.instanceCount += figureNames.length;
      summary.segments.push({ name: segment.name, figureNames });
    }

    return map;
  }

  /**
   * Aplica l'ordenació a la query. El mode `chronological` usa una lògica intel·ligent:
   * primer els events propers (ordenats per data ASC), després els passats (ordenats DESC).
   */
  private applySort(
    qb: SelectQueryBuilder<Event>,
    sortBy: EventSortByField | undefined,
    sortOrder: EventSortOrder | undefined,
  ): void {
    const direction: EventSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    if (!sortBy || sortBy === 'chronological') {
      // Smart chronological: upcoming first (nearest date), then past (most recent first).
      // TypeORM cannot parse raw CASE WHEN in addOrderBy — use addSelect aliases instead.
      qb.addSelect(`CASE WHEN event.date >= CURRENT_DATE THEN 0 ELSE 1 END`, 'sort_group')
        .addSelect(`CASE WHEN event.date >= CURRENT_DATE THEN event.date END`, 'sort_asc')
        .addSelect(`CASE WHEN event.date < CURRENT_DATE THEN event.date END`, 'sort_desc')
        .orderBy('sort_group', 'ASC')
        .addOrderBy('sort_asc', 'ASC', 'NULLS LAST')
        .addOrderBy('sort_desc', 'DESC', 'NULLS LAST');
      return;
    }

    const column = EVENT_SORT_COLUMN_MAP[sortBy] ?? 'event.date';
    if (column.includes('(')) {
      qb.addSelect(column, 'sort_column').orderBy('sort_column', direction);
    } else {
      qb.orderBy(column, direction);
    }
  }
}

interface SeasonRef {
  id: string;
  name: string;
}

export interface SegmentsSummary {
  segmentCount: number;
  instanceCount: number;
  segments: { name: string | null; figureNames: string[] }[];
}

export interface EventListItem {
  id: string;
  eventType: string;
  title: string;
  date: Date;
  startTime: string | null;
  location: string | null;
  countsForStatistics: boolean;
  attendanceSummary: Record<string, number>;
  season: SeasonRef | null;
  segmentsSummary: SegmentsSummary | null;
  createdAt: Date;
}

export interface EventDetailItem extends EventListItem {
  description: string | null;
  locationUrl: string | null;
  information: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  isSynced: boolean;
}

function toSeasonRef(season: Season | null | undefined): SeasonRef | null {
  if (!season) return null;
  return { id: season.id, name: season.name };
}

function toListItem(event: EventWithSeason, segmentsSummary: SegmentsSummary | null): EventListItem {
  return {
    id: event.id,
    eventType: event.eventType,
    title: event.title,
    date: event.date,
    startTime: event.startTime,
    location: event.location,
    countsForStatistics: event.countsForStatistics,
    attendanceSummary: event.attendanceSummary as unknown as Record<string, number>,
    season: toSeasonRef(event.season),
    segmentsSummary,
    createdAt: event.createdAt,
  };
}

function toDetailItem(event: Event, season: Season | null): EventDetailItem {
  return {
    ...toListItem({ ...event, season }, null),
    description: event.description,
    locationUrl: event.locationUrl,
    information: event.information,
    notes: event.notes,
    metadata: event.metadata as unknown as Record<string, unknown>,
    isSynced: event.legacyId !== null,
  };
}
