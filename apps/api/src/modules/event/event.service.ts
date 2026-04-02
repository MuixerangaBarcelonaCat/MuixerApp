import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { Season } from '../season/season.entity';
import { EventFilterDto } from './dto/event-filter.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  EVENT_SORT_COLUMN_MAP,
  type EventSortByField,
  type EventSortOrder,
} from './constants/event-sort.constants';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Season)
    private readonly seasonRepository: Repository<Season>,
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
      page = 1,
      limit = 25,
    } = filters;

    const orderColumn = this.resolveSortColumn(sortBy);
    const orderDirection: EventSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.season', 'season');

    if (seasonId) {
      qb.andWhere('season.id = :seasonId', { seasonId });
    }

    if (eventType) {
      qb.andWhere('event.eventType = :eventType', { eventType });
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

    const events = await qb
      .orderBy(orderColumn, orderDirection)
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

  async update(id: string, dto: UpdateEventDto): Promise<EventDetailItem> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['season'],
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    if (dto.countsForStatistics !== undefined) {
      event.countsForStatistics = dto.countsForStatistics;
    }

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

  private resolveSortColumn(sortBy: EventSortByField | undefined): string {
    if (!sortBy) return EVENT_SORT_COLUMN_MAP.date;
    return EVENT_SORT_COLUMN_MAP[sortBy] ?? EVENT_SORT_COLUMN_MAP.date;
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
}

export interface EventDetailItem extends EventListItem {
  description: string | null;
  locationUrl: string | null;
  information: string | null;
  metadata: Record<string, unknown>;
  legacyId: string | null;
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
  };
}

function toDetailItem(event: Event): EventDetailItem {
  return {
    ...toListItem(event),
    description: event.description,
    locationUrl: event.locationUrl,
    information: event.information,
    metadata: event.metadata as unknown as Record<string, unknown>,
    legacyId: event.legacyId,
  };
}
