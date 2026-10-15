import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventType, SEASON_LEAVES_EVENTS_UNCOVERED } from '@muixer/shared';
import { Season } from './season.entity';
import { Event } from '../event/event.entity';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';
import { getLocalToday } from '../../common/utils/date.util';

/** Postgres exclusion-constraint violation: `EX_seasons_no_overlap` caught two overlapping seasons. */
const PG_EXCLUSION_VIOLATION = '23P01';

/** Join condition putting an event in the season whose inclusive date range contains its date. */
const EVENT_IN_SEASON = 'event.date BETWEEN season.startDate AND season.endDate';

export interface SeasonMutationOptions {
  /** Go ahead even if some events would end up with no season (the client has asked the user). */
  allowUncovered?: boolean;
}

@Injectable()
export class SeasonService {
  constructor(
    @InjectRepository(Season)
    private readonly seasonRepository: Repository<Season>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  async findAll(): Promise<{ data: SeasonListItem[]; total: number }> {
    const seasons = await this.seasonRepository
      .createQueryBuilder('season')
      .orderBy('season.startDate', 'DESC')
      .getMany();

    const counts = await this.countEventsBySeason(seasons.map((s) => s.id));
    const data = seasons.map((s) => this.toListItem(s, counts.get(s.id) ?? NO_EVENTS));
    return { data, total: data.length };
  }

  async findOne(id: string): Promise<SeasonListItem> {
    const season = await this.seasonRepository
      .createQueryBuilder('season')
      .where('season.id = :id', { id })
      .getOne();

    if (!season) {
      throw new NotFoundException(`Season with ID ${id} not found`);
    }

    return this.withEventCount(season);
  }

  async findCurrent(): Promise<SeasonListItem> {
    const season = await this.findCurrentEntity();
    if (!season) {
      throw new NotFoundException('No seasons found');
    }
    return this.withEventCount(season);
  }

  /** The season containing today (Europe/Madrid), or else the most recent one; null if there are none. */
  async findCurrentEntity(): Promise<Season | null> {
    const season = await this.seasonRepository
      .createQueryBuilder('season')
      .where(':today BETWEEN season.startDate AND season.endDate', { today: getLocalToday() })
      .getOne();

    if (season) return season;

    return this.seasonRepository
      .createQueryBuilder('season')
      .orderBy('season.startDate', 'DESC')
      .getOne();
  }

  /** The season whose inclusive range contains `date` (`YYYY-MM-DD`). Seasons never overlap, so at most one. */
  findByDate(date: string): Promise<Season | null> {
    return this.seasonRepository
      .createQueryBuilder('season')
      .where(':date BETWEEN season.startDate AND season.endDate', { date })
      .getOne();
  }

  /** Events whose date falls in no season («Sense temporada»). */
  async countUncoveredEvents(): Promise<{ count: number }> {
    const count = await this.eventRepository
      .createQueryBuilder('event')
      .leftJoin(Season, 'season', EVENT_IN_SEASON)
      .where('season.id IS NULL')
      .getCount();
    return { count };
  }

  async create(dto: CreateSeasonDto): Promise<SeasonListItem> {
    this.validateDateRange(dto.startDate, dto.endDate);
    await this.checkNameUnique(dto.name);
    await this.checkOverlap(dto.startDate, dto.endDate);

    const season = this.seasonRepository.create({
      name: dto.name,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      description: dto.description ?? null,
    });

    const saved = await this.saveSeason(season);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateSeasonDto, options: SeasonMutationOptions = {}): Promise<SeasonListItem> {
    const season = await this.seasonRepository.findOne({ where: { id } });
    if (!season) {
      throw new NotFoundException(`Season with ID ${id} not found`);
    }

    if (dto.name !== undefined && dto.name !== season.name) {
      await this.checkNameUnique(dto.name, id);
    }

    const oldStart = toDateOnly(season.startDate);
    const oldEnd = toDateOnly(season.endDate);
    const startDate = dto.startDate ?? oldStart;
    const endDate = dto.endDate ?? oldEnd;

    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      this.validateDateRange(startDate, endDate);
      await this.checkOverlap(startDate, endDate, id);
      if (!options.allowUncovered) {
        // Seasons never overlap, so an event leaving this season's range has no other season to fall into.
        const leftOut = await this.eventRepository
          .createQueryBuilder('event')
          .where('event.date BETWEEN :oldStart AND :oldEnd', { oldStart, oldEnd })
          .andWhere('NOT (event.date BETWEEN :newStart AND :newEnd)', { newStart: startDate, newEnd: endDate })
          .getCount();
        if (leftOut > 0) throw uncoveredConflict(leftOut);
      }
    }

    if (dto.name !== undefined) season.name = dto.name;
    if (dto.startDate !== undefined) season.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) season.endDate = new Date(dto.endDate);
    if (dto.description !== undefined) season.description = dto.description ?? null;

    await this.saveSeason(season);
    return this.findOne(id);
  }

  async remove(id: string, options: SeasonMutationOptions = {}): Promise<void> {
    const season = await this.seasonRepository
      .createQueryBuilder('season')
      .where('season.id = :id', { id })
      .getOne();

    if (!season) {
      throw new NotFoundException(`Season with ID ${id} not found`);
    }

    const counts = await this.countEventsBySeason([season.id]);
    const eventCount = counts.get(season.id)?.eventCount ?? 0;
    if (eventCount > 0 && !options.allowUncovered) {
      throw uncoveredConflict(eventCount);
    }

    await this.seasonRepository.remove(season);
  }

  /** Saves a season, turning the overlap exclusion constraint (a concurrent create/update race) into a 409. */
  private async saveSeason(season: Season): Promise<Season> {
    try {
      return await this.seasonRepository.save(season);
    } catch (err) {
      if ((err as { code?: string })?.code === PG_EXCLUSION_VIOLATION) {
        throw new ConflictException('Les dates se solapen amb una altra temporada');
      }
      throw err;
    }
  }

  /** Events whose date falls in each season's range, by type, keyed by season id (seasons with none are absent). */
  private async countEventsBySeason(seasonIds: string[]): Promise<Map<string, SeasonEventCounts>> {
    if (seasonIds.length === 0) return new Map();
    const rows = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoin(Season, 'season', EVENT_IN_SEASON)
      .select('season.id', 'seasonId')
      .addSelect('event.eventType', 'eventType')
      .addSelect('COUNT(event.id)', 'count')
      .where('season.id IN (:...seasonIds)', { seasonIds })
      .groupBy('season.id')
      .addGroupBy('event.eventType')
      .getRawMany<{ seasonId: string; eventType: EventType; count: string }>();
    const counts = new Map<string, SeasonEventCounts>();
    for (const { seasonId, eventType, count } of rows) {
      const entry = counts.get(seasonId) ?? { ...NO_EVENTS };
      const n = Number(count);
      entry.eventCount += n;
      if (eventType === EventType.ASSAIG) entry.rehearsalCount += n;
      else if (eventType === EventType.ACTUACIO) entry.performanceCount += n;
      counts.set(seasonId, entry);
    }
    return counts;
  }

  private async withEventCount(season: Season): Promise<SeasonListItem> {
    const counts = await this.countEventsBySeason([season.id]);
    return this.toListItem(season, counts.get(season.id) ?? NO_EVENTS);
  }

  private validateDateRange(startDate: string, endDate: string): void {
    if (new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException(
        'La data de fi ha de ser posterior a la data d\'inici',
      );
    }
  }

  private async checkNameUnique(name: string, excludeId?: string): Promise<void> {
    const qb = this.seasonRepository
      .createQueryBuilder('season')
      .where('season.name = :name', { name });

    if (excludeId) {
      qb.andWhere('season.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException('Ja existeix una temporada amb aquest nom');
    }
  }

  private async checkOverlap(startDate: string, endDate: string, excludeId?: string): Promise<void> {
    const qb = this.seasonRepository
      .createQueryBuilder('season')
      .where(
        'season.startDate <= :endDate AND season.endDate >= :startDate',
        { startDate, endDate },
      );

    if (excludeId) {
      qb.andWhere('season.id != :excludeId', { excludeId });
    }

    const overlapping = await qb.getOne();
    if (overlapping) {
      throw new ConflictException(
        `Les dates se solapen amb la temporada "${overlapping.name}"`,
      );
    }
  }

  private toListItem(season: Season, counts: SeasonEventCounts): SeasonListItem {
    return {
      id: season.id,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
      description: season.description,
      ...counts,
    };
  }
}

export interface SeasonEventCounts {
  /** All events in the season, whatever their type. */
  eventCount: number;
  rehearsalCount: number;
  performanceCount: number;
}

const NO_EVENTS: SeasonEventCounts = { eventCount: 0, rehearsalCount: 0, performanceCount: 0 };

export interface SeasonListItem extends SeasonEventCounts {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  description: string | null;
}

/**
 * `date` columns come back from pg as `YYYY-MM-DD` strings despite the `Date` typing; values set in code
 * are UTC-midnight `Date`s. Either way, return the calendar date.
 */
function toDateOnly(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function uncoveredConflict(count: number): ConflictException {
  const message =
    count === 1
      ? '1 esdeveniment quedaria fora de qualsevol temporada.'
      : `${count} esdeveniments quedarien fora de qualsevol temporada.`;
  return new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code: SEASON_LEAVES_EVENTS_UNCOVERED,
    uncoveredCount: count,
    message,
  });
}
