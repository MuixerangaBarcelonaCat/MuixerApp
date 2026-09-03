import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FigureZone } from '@muixer/shared';
import { Composition } from './entities/composition.entity';
import { CompositionEntry } from './entities/composition-entry.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { CreateCompositionDto, CreateCompositionEntryDto } from './dto/create-composition.dto';
import { UpdateCompositionDto } from './dto/update-composition.dto';
import { CompositionFilterDto } from './dto/composition-filter.dto';
import { FigureNodeItem } from '../figure/figure-template.service';
import { loadTroncProfiles } from '../figure/tronc-profile.util';

// ─── Response interfaces ────────────────────────────────────────────────────

export interface CompositionListItem {
  id: string;
  name: string;
  description: string | null;
  entryCount: number;
  /** One troncProfile per entry, same order as entries — see FigureTemplateListItem.troncProfile. */
  figureProfiles: number[][];
  createdAt: Date;
  updatedAt: Date;
}

export interface CompositionEntryItem {
  id: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  angle: number;
  troncPanelX: number | null;
  troncPanelY: number | null;
  figureMode: string;
  numberOfCordons: number | null;
  cordonsObertsEnabled: boolean;
  sortOrder: number;
  troncGridCols: number;
  troncGridRows: number;
  figureTemplate: {
    id: string;
    name: string;
    hasPinya: boolean;
    direction: number;
    nodes: FigureNodeItem[];
  };
}

export interface CompositionDetail {
  id: string;
  name: string;
  description: string | null;
  entries: CompositionEntryItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedCompositions {
  data: CompositionListItem[];
  meta: { total: number; page: number; limit: number };
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class CompositionService {
  constructor(
    @InjectRepository(Composition)
    private readonly compositionRepository: Repository<Composition>,
    @InjectRepository(CompositionEntry)
    private readonly entryRepository: Repository<CompositionEntry>,
    @InjectRepository(FigureTemplate)
    private readonly templateRepository: Repository<FigureTemplate>,
    @InjectRepository(FigureNode)
    private readonly nodeRepository: Repository<FigureNode>,
  ) {}

  async findAll(filter: CompositionFilterDto): Promise<PaginatedCompositions> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.compositionRepository
      .createQueryBuilder('composition')
      .leftJoinAndSelect('composition.entries', 'entries')
      .leftJoin('entries.figureTemplate', 'entryTemplate')
      .addSelect(['entryTemplate.id'])
      .orderBy('composition.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.search) {
      qb.andWhere('composition.name ILIKE :search', { search: `%${filter.search}%` });
    }

    const [compositions, total] = await Promise.all([qb.getMany(), qb.getCount()]);

    const templateIds = Array.from(
      new Set(
        compositions
          .flatMap((c) => c.entries ?? [])
          .map((e) => e.figureTemplate?.id)
          .filter((id): id is string => !!id),
      ),
    );
    const troncProfiles = await loadTroncProfiles(this.nodeRepository, templateIds);

    return {
      data: compositions.map((c) => this.toListItem(c, troncProfiles)),
      meta: { total, page, limit },
    };
  }

  async findOne(id: string): Promise<CompositionDetail> {
    const composition = await this.compositionRepository.findOne({
      where: { id },
      relations: ['entries', 'entries.figureTemplate', 'entries.figureTemplate.nodes'],
    });
    if (!composition) {
      throw new NotFoundException(`Composition with ID ${id} not found`);
    }
    return this.toDetail(composition);
  }

  async create(dto: CreateCompositionDto): Promise<CompositionDetail> {
    const composition = this.compositionRepository.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    const saved = await this.compositionRepository.save(composition);

    if (dto.entries?.length) {
      await this.syncEntries(saved.id, dto.entries);
    }

    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateCompositionDto): Promise<CompositionDetail> {
    const composition = await this.compositionRepository.findOne({ where: { id } });
    if (!composition) {
      throw new NotFoundException(`Composition with ID ${id} not found`);
    }

    if (dto.name !== undefined) composition.name = dto.name;
    if (dto.description !== undefined) composition.description = dto.description ?? null;

    await this.compositionRepository.save(composition);

    if (dto.entries !== undefined) {
      await this.syncEntries(id, dto.entries);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const composition = await this.compositionRepository.findOne({ where: { id } });
    if (!composition) {
      throw new NotFoundException(`Composition with ID ${id} not found`);
    }
    await this.compositionRepository.remove(composition);
  }

  async duplicate(id: string): Promise<CompositionDetail> {
    const source = await this.compositionRepository.findOne({
      where: { id },
      relations: ['entries', 'entries.figureTemplate'],
    });
    if (!source) {
      throw new NotFoundException(`Composition with ID ${id} not found`);
    }

    const copy = this.compositionRepository.create({
      name: `${source.name} - còpia`,
      description: source.description,
    });
    const savedCopy = await this.compositionRepository.save(copy);

    if (source.entries?.length) {
      const entryDtos = source.entries.map((e) => ({
        figureTemplateId: e.figureTemplate.id,
        label: e.label ?? undefined,
        offsetX: e.offsetX,
        offsetY: e.offsetY,
        angle: e.angle,
        troncPanelX: e.troncPanelX ?? undefined,
        troncPanelY: e.troncPanelY ?? undefined,
        figureMode: e.figureMode,
        numberOfCordons: e.numberOfCordons ?? undefined,
        cordonsObertsEnabled: e.cordonsObertsEnabled,
        sortOrder: e.sortOrder,
      }));
      await this.syncEntries(savedCopy.id, entryDtos);
    }

    return this.findOne(savedCopy.id);
  }

  private async syncEntries(compositionId: string, dtos: CreateCompositionEntryDto[]): Promise<void> {
    await this.entryRepository.delete({ composition: { id: compositionId } });

    const entries: CompositionEntry[] = [];
    for (const dto of dtos) {
      const figureTemplate = await this.templateRepository.findOne({ where: { id: dto.figureTemplateId } });
      if (!figureTemplate) {
        throw new NotFoundException(`FigureTemplate with ID ${dto.figureTemplateId} not found`);
      }
      const entry = this.entryRepository.create({
        composition: { id: compositionId } as Composition,
        figureTemplate,
        label: dto.label ?? null,
        offsetX: dto.offsetX ?? 0,
        offsetY: dto.offsetY ?? 0,
        angle: dto.angle ?? 0,
        troncPanelX: dto.troncPanelX ?? null,
        troncPanelY: dto.troncPanelY ?? null,
        figureMode: dto.figureMode,
        numberOfCordons: dto.numberOfCordons ?? null,
        cordonsObertsEnabled: dto.cordonsObertsEnabled ?? true,
        sortOrder: dto.sortOrder ?? 0,
      });
      entries.push(entry);
    }
    await this.entryRepository.save(entries);
  }

  private toListItem(
    composition: Composition,
    troncProfiles: Map<string, number[]> = new Map(),
  ): CompositionListItem {
    return {
      id: composition.id,
      name: composition.name,
      description: composition.description,
      entryCount: composition.entries?.length ?? 0,
      figureProfiles: (composition.entries ?? []).map(
        (e) => troncProfiles.get(e.figureTemplate?.id ?? '') ?? [],
      ),
      createdAt: composition.createdAt,
      updatedAt: composition.updatedAt,
    };
  }

  private toDetail(composition: Composition): CompositionDetail {
    return {
      id: composition.id,
      name: composition.name,
      description: composition.description,
      entries: (composition.entries ?? []).map((e) => this.toEntryItem(e)),
      createdAt: composition.createdAt,
      updatedAt: composition.updatedAt,
    };
  }

  private toEntryItem(entry: CompositionEntry): CompositionEntryItem {
    const allNodes = entry.figureTemplate?.nodes ?? [];

    const troncNodes = allNodes.filter((n) => n.zone === FigureZone.TRONC);
    const troncGridCols = troncNodes.reduce((max, n) => Math.max(max, n.x + n.width), 0);
    const distinctZLevels = new Set(troncNodes.map((n) => n.z)).size;
    const hasFigureDirection = allNodes.some((n) => n.zone === FigureZone.FIGURE_DIRECTION);
    const hasXicallaDirection = allNodes.some((n) => n.zone === FigureZone.XICALLA_DIRECTION);
    const troncGridRows = distinctZLevels + (hasFigureDirection ? 1 : 0) + (hasXicallaDirection ? 1 : 0);

    const template = entry.figureTemplate;
    return {
      id: entry.id,
      label: entry.label,
      offsetX: entry.offsetX,
      offsetY: entry.offsetY,
      angle: entry.angle,
      troncPanelX: entry.troncPanelX,
      troncPanelY: entry.troncPanelY,
      figureMode: entry.figureMode,
      numberOfCordons: entry.numberOfCordons,
      cordonsObertsEnabled: entry.cordonsObertsEnabled,
      sortOrder: entry.sortOrder,
      troncGridCols,
      troncGridRows,
      figureTemplate: {
        id: template.id,
        name: template.name,
        hasPinya: allNodes.some((n) => n.zone === FigureZone.PINYA),
        direction: template.direction,
        nodes: allNodes.map((n) => ({
          id: n.id,
          label: n.label,
          zone: n.zone,
          positionType: n.positionType,
          x: n.x,
          y: n.y,
          z: n.z,
          width: n.width,
          height: n.height,
          rotation: n.rotation,
          color: n.color,
          shape: n.shape,
          sortOrder: n.sortOrder,
          climbIndicator: n.climbIndicator,
          ringLevel: n.ringLevel,
          originNodeId: n.originNodeId,
          renglaId: n.renglaId,
          renglaPosition: n.renglaPosition,
          metadata: n.metadata,
        })),
      },
    };
  }
}
