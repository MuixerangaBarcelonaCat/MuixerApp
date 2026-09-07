import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Season } from './season.entity';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@Injectable()
export class SeasonService {
  constructor(
    @InjectRepository(Season)
    private readonly seasonRepository: Repository<Season>,
  ) {}

  async findAll(): Promise<{ data: SeasonListItem[]; total: number }> {
    const seasons = await this.seasonRepository
      .createQueryBuilder('season')
      .loadRelationCountAndMap('season.eventCount', 'season.events')
      .orderBy('season.startDate', 'DESC')
      .getMany();

    const data = seasons.map((s) => this.toListItem(s));
    return { data, total: data.length };
  }

  async findOne(id: string): Promise<SeasonListItem> {
    const season = await this.seasonRepository
      .createQueryBuilder('season')
      .loadRelationCountAndMap('season.eventCount', 'season.events')
      .where('season.id = :id', { id })
      .getOne();

    if (!season) {
      throw new NotFoundException(`Season with ID ${id} not found`);
    }

    return this.toListItem(season);
  }

  async findCurrent(): Promise<SeasonListItem> {
    const today = new Date().toISOString().slice(0, 10);

    let season = await this.seasonRepository
      .createQueryBuilder('season')
      .loadRelationCountAndMap('season.eventCount', 'season.events')
      .where('season.startDate <= :today AND season.endDate >= :today', { today })
      .getOne();

    if (!season) {
      season = await this.seasonRepository
        .createQueryBuilder('season')
        .loadRelationCountAndMap('season.eventCount', 'season.events')
        .orderBy('season.startDate', 'DESC')
        .getOne();
    }

    if (!season) {
      throw new NotFoundException('No seasons found');
    }

    return this.toListItem(season);
  }

  async findCurrentEntity(): Promise<Season | null> {
    const today = new Date().toISOString().slice(0, 10);

    const season = await this.seasonRepository
      .createQueryBuilder('season')
      .where('season.startDate <= :today AND season.endDate >= :today', { today })
      .getOne();

    if (season) return season;

    return this.seasonRepository
      .createQueryBuilder('season')
      .orderBy('season.startDate', 'DESC')
      .getOne();
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

    const saved = await this.seasonRepository.save(season);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateSeasonDto): Promise<SeasonListItem> {
    const season = await this.seasonRepository.findOne({ where: { id } });
    if (!season) {
      throw new NotFoundException(`Season with ID ${id} not found`);
    }

    if (dto.name !== undefined && dto.name !== season.name) {
      await this.checkNameUnique(dto.name, id);
    }

    const startDate = dto.startDate ?? season.startDate.toString().slice(0, 10);
    const endDate = dto.endDate ?? season.endDate.toString().slice(0, 10);

    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      this.validateDateRange(startDate, endDate);
      await this.checkOverlap(startDate, endDate, id);
    }

    if (dto.name !== undefined) season.name = dto.name;
    if (dto.startDate !== undefined) season.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) season.endDate = new Date(dto.endDate);
    if (dto.description !== undefined) season.description = dto.description ?? null;

    await this.seasonRepository.save(season);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const season = await this.seasonRepository
      .createQueryBuilder('season')
      .loadRelationCountAndMap('season.eventCount', 'season.events')
      .where('season.id = :id', { id })
      .getOne() as (Season & { eventCount?: number }) | null;

    if (!season) {
      throw new NotFoundException(`Season with ID ${id} not found`);
    }

    const eventCount = season.eventCount ?? 0;
    if (eventCount > 0) {
      throw new ConflictException(
        `No es pot eliminar: la temporada té ${eventCount} events associats`,
      );
    }

    await this.seasonRepository.remove(season);
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

  private toListItem(season: Season & { eventCount?: number }): SeasonListItem {
    return {
      id: season.id,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
      description: season.description,
      eventCount: season.eventCount ?? 0,
    };
  }
}

export interface SeasonListItem {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  description: string | null;
  eventCount: number;
}
