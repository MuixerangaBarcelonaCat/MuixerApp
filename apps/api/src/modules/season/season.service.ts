import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Season } from './season.entity';

@Injectable()
export class SeasonService {
  constructor(
    @InjectRepository(Season)
    private readonly seasonRepository: Repository<Season>,
  ) {}

  /** Retorna totes les temporades ordenades per data d'inici DESC, incloent el recompte d'events de cada una. */
  async findAll(): Promise<{ data: SeasonListItem[]; total: number }> {
    const seasons = await this.seasonRepository
      .createQueryBuilder('season')
      .loadRelationCountAndMap('season.eventCount', 'season.events')
      .orderBy('season.startDate', 'DESC')
      .getMany();

    const data = seasons.map((s) => this.toListItem(s));
    return { data, total: data.length };
  }

  /** Retorna el detall d'una temporada per ID incloent el recompte d'events. Llança NotFoundException si no existeix. */
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

  /** Transforma l'entitat Season (amb la relació virtual eventCount) al DTO de llista. */
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
