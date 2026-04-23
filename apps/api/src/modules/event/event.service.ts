import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { Attendance } from './attendance.entity';
import { Season } from '../season/season.entity';
import { EventFilterDto } from './dto/event-filter.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  EVENT_SORT_COLUMN_MAP,
  type EventSortByField,
  type EventSortOrder,
} from './constants/event-sort.constants';
import { SelectQueryBuilder } from 'typeorm';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Season)
    private readonly seasonRepository: Repository<Season>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
  ) {}

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

    const qb = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.season', 'season');

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

    const events = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data: events.map(toListItem), total };
  }

  async findOne(id: string): Promise<EventDetailItem> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['season'],
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return toDetailItem(event);
  }

  async create(dto: CreateEventDto): Promise<EventDetailItem> {
    const event = this.eventRepository.create({
      title: dto.title,
      eventType: dto.eventType,
      date: new Date(dto.date),
      startTime: dto.startTime ?? null,
      location: dto.location ?? null,
      locationUrl: dto.locationUrl ?? null,
      description: dto.description ?? null,
      information: dto.information ?? null,
      countsForStatistics: dto.countsForStatistics ?? true,
    });

    if (dto.seasonId) {
      const season = await this.seasonRepository.findOne({ where: { id: dto.seasonId } });
      if (!season) {
        throw new NotFoundException(`Season with ID ${dto.seasonId} not found`);
      }
      event.season = season;
    }

    const saved = await this.eventRepository.save(event);
    const withRelations = await this.eventRepository.findOne({
      where: { id: saved.id },
      relations: ['season'],
    });
    return toDetailItem(withRelations!);
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDetailItem> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['season'],
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.date !== undefined) event.date = new Date(dto.date);
    if (dto.startTime !== undefined) event.startTime = dto.startTime;
    if (dto.location !== undefined) event.location = dto.location ?? null;
    if (dto.locationUrl !== undefined) event.locationUrl = dto.locationUrl ?? null;
    if (dto.description !== undefined) event.description = dto.description ?? null;
    if (dto.information !== undefined) event.information = dto.information ?? null;
    if (dto.countsForStatistics !== undefined) event.countsForStatistics = dto.countsForStatistics;

    if (dto.seasonId !== undefined) {
      const season = await this.seasonRepository.findOne({ where: { id: dto.seasonId } });
      if (!season) {
        throw new NotFoundException(`Season with ID ${dto.seasonId} not found`);
      }
      event.season = season;
    }

    const saved = await this.eventRepository.save(event);
    return toDetailItem(saved);
  }

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
    qb.orderBy(column, direction);
  }
}

export interface SeasonRef {
  id: string;
  name: string;
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
  createdAt: Date;
}

export interface EventDetailItem extends EventListItem {
  description: string | null;
  locationUrl: string | null;
  information: string | null;
  metadata: Record<string, unknown>;
  isSynced: boolean;
}

function toSeasonRef(season: Season | null): SeasonRef | null {
  if (!season) return null;
  return { id: season.id, name: season.name };
}

function toListItem(event: Event): EventListItem {
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
    createdAt: event.createdAt,
  };
}

function toDetailItem(event: Event): EventDetailItem {
  return {
    ...toListItem(event),
    description: event.description,
    locationUrl: event.locationUrl,
    information: event.information,
    metadata: event.metadata as unknown as Record<string, unknown>,
    isSynced: event.legacyId !== null,
  };
}
