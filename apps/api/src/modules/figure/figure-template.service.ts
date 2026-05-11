import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { CreateFigureTemplateDto } from './dto/create-figure-template.dto';
import { UpdateFigureTemplateDto } from './dto/update-figure-template.dto';
import { FigureTemplateFilterDto } from './dto/figure-template-filter.dto';
import { CreateFigureNodeDto } from './dto/create-figure-node.dto';

export interface FigureNodeItem {
  id: string;
  label: string;
  zone: string;
  positionType: string | null;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: string;
  sortOrder: number;
  climbPath: string | null;
  metadata: Record<string, unknown>;
}

export interface FigureTemplateListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hasPinya: boolean;
  direction: number;
  nodeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FigureTemplateDetailItem extends FigureTemplateListItem {
  metadata: Record<string, unknown>;
  nodes: FigureNodeItem[];
}

@Injectable()
export class FigureTemplateService {
  constructor(
    @InjectRepository(FigureTemplate)
    private readonly templateRepository: Repository<FigureTemplate>,
    @InjectRepository(FigureNode)
    private readonly nodeRepository: Repository<FigureNode>,
    @InjectRepository(CompositionSlot)
    private readonly compositionSlotRepository: Repository<CompositionSlot>,
    @InjectRepository(FigureInstance)
    private readonly figureInstanceRepository: Repository<FigureInstance>,
  ) {}

  async findAll(filters: FigureTemplateFilterDto): Promise<{ data: FigureTemplateListItem[]; total: number }> {
    const { search, hasPinya, page = 1, limit = 25 } = filters;

    const qb = this.templateRepository
      .createQueryBuilder('template')
      .loadRelationCountAndMap('template.nodeCount', 'template.nodes');

    if (search) {
      qb.andWhere(
        '(unaccent(template.name) ILIKE unaccent(:search) OR template.slug ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (hasPinya !== undefined) {
      qb.andWhere('template.hasPinya = :hasPinya', { hasPinya });
    }

    const total = await qb.getCount();

    const templates = await qb
      .orderBy('template.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data: templates.map(toListItem), total };
  }

  async findOne(id: string): Promise<FigureTemplateDetailItem> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['nodes'],
    });

    if (!template) {
      throw new NotFoundException(`FigureTemplate with ID ${id} not found`);
    }

    return toDetailItem(template);
  }

  async create(dto: CreateFigureTemplateDto): Promise<FigureTemplateDetailItem> {
    await this.assertSlugAvailable(dto.slug);

    const template = this.templateRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      hasPinya: dto.hasPinya ?? true,
      direction: dto.direction ?? 0,
      metadata: dto.metadata ?? {},
    });

    let saved: FigureTemplate;
    try {
      saved = await this.templateRepository.save(template);
    } catch (err) {
      this.handleDbError(err);
    }

    if (dto.nodes && dto.nodes.length > 0) {
      await this.createNodes(saved!, dto.nodes);
    }

    return this.findOne(saved!.id);
  }

  async update(id: string, dto: UpdateFigureTemplateDto): Promise<FigureTemplateDetailItem> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['nodes'],
    });

    if (!template) {
      throw new NotFoundException(`FigureTemplate with ID ${id} not found`);
    }

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.slug !== undefined) {
      await this.assertSlugAvailable(dto.slug, id);
      template.slug = dto.slug;
    }
    if (dto.description !== undefined) template.description = dto.description ?? null;
    if (dto.hasPinya !== undefined) template.hasPinya = dto.hasPinya;
    if (dto.direction !== undefined) template.direction = dto.direction;
    if (dto.metadata !== undefined) template.metadata = dto.metadata ?? {};

    try {
      await this.templateRepository.save(template);
    } catch (err) {
      this.handleDbError(err);
    }

    if (dto.nodes !== undefined) {
      await this.syncNodes(template, dto.nodes);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const template = await this.templateRepository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException(`FigureTemplate with ID ${id} not found`);
    }

    const slotCount = await this.compositionSlotRepository.count({
      where: { figureTemplate: { id } },
    });

    if (slotCount > 0) {
      throw new ConflictException(
        `Cannot delete FigureTemplate: it is referenced by ${slotCount} composition slot(s)`,
      );
    }

    const instanceCount = await this.figureInstanceRepository.count({
      where: { figureTemplate: { id } },
    });

    if (instanceCount > 0) {
      throw new ConflictException(
        `Aquesta figura s'utilitza a ${instanceCount} event(s) i no es pot eliminar.`,
      );
    }

    await this.templateRepository.remove(template);
  }

  async duplicate(id: string): Promise<FigureTemplateDetailItem> {
    const original = await this.templateRepository.findOne({
      where: { id },
      relations: ['nodes'],
    });

    if (!original) {
      throw new NotFoundException(`FigureTemplate with ID ${id} not found`);
    }

    const copy = this.templateRepository.create({
      name: `${original.name} (còpia)`,
      slug: `${original.slug}-copia-${Date.now()}`,
      description: original.description,
      hasPinya: original.hasPinya,
      direction: original.direction,
      metadata: original.metadata,
    });

    const savedCopy = await this.templateRepository.save(copy);

    if (original.nodes && original.nodes.length > 0) {
      await this.createNodes(savedCopy, original.nodes.map(nodeToCreateDto));
    }

    return this.findOne(savedCopy.id);
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.templateRepository.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `The slug "${slug}" is already in use by another figure template`,
      );
    }
  }

  /** Converts PostgreSQL unique-constraint violations (23505) into ConflictExceptions. */
  private handleDbError(err: unknown): never {
    const pgErr = err as { code?: string; detail?: string };
    if (pgErr?.code === '23505') {
      const slugMatch = pgErr.detail?.match(/Key \(slug\)=\(([^)]+)\)/);
      const slug = slugMatch ? slugMatch[1] : 'unknown';
      throw new ConflictException(
        `The slug "${slug}" is already in use by another figure template`,
      );
    }
    throw new InternalServerErrorException('Unexpected database error');
  }

  private async createNodes(template: FigureTemplate, dtos: CreateFigureNodeDto[]): Promise<void> {
    const nodes = dtos.map((dto) =>
      this.nodeRepository.create({
        template,
        label: dto.label,
        zone: dto.zone,
        positionType: dto.positionType ?? null,
        x: dto.x,
        y: dto.y,
        z: dto.z ?? 0,
        width: dto.width,
        height: dto.height,
        rotation: dto.rotation ?? 0,
        color: dto.color ?? null,
        shape: dto.shape,
        sortOrder: dto.sortOrder ?? 0,
        climbPath: dto.climbPath ?? null,
        metadata: dto.metadata ?? {},
      }),
    );
    await this.nodeRepository.save(nodes);
  }

  private async syncNodes(template: FigureTemplate, incomingDtos: CreateFigureNodeDto[]): Promise<void> {
    await this.nodeRepository.delete({ template: { id: template.id } });
    await this.createNodes(template, incomingDtos);
  }
}

function nodeToCreateDto(node: FigureNode): CreateFigureNodeDto {
  return {
    label: node.label,
    zone: node.zone,
    positionType: node.positionType ?? undefined,
    x: node.x,
    y: node.y,
    z: node.z,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    color: node.color ?? undefined,
    shape: node.shape,
    sortOrder: node.sortOrder,
    climbPath: node.climbPath ?? undefined,
    metadata: node.metadata,
  };
}

function toListItem(template: FigureTemplate & { nodeCount?: number }): FigureTemplateListItem {
  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description,
    hasPinya: template.hasPinya,
    direction: template.direction,
    nodeCount: (template as unknown as { nodeCount: number }).nodeCount ?? 0,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function toDetailItem(template: FigureTemplate): FigureTemplateDetailItem {
  return {
    ...toListItem(template),
    metadata: template.metadata,
    nodes: (template.nodes ?? []).map((node) => ({
      id: node.id,
      label: node.label,
      zone: node.zone,
      positionType: node.positionType,
      x: node.x,
      y: node.y,
      z: node.z,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      color: node.color,
      shape: node.shape,
      sortOrder: node.sortOrder,
      climbPath: node.climbPath,
      metadata: node.metadata,
    })),
  };
}
