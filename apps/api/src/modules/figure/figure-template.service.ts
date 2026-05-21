import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FigureZone } from '@muixer/shared';
import { FigureFamily } from './entities/figure-family.entity';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { FigureFamilyNode } from './entities/figure-family-node.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { CreateFigureTemplateDto } from './dto/create-figure-template.dto';
import { UpdateFigureTemplateDto } from './dto/update-figure-template.dto';
import { FigureTemplateFilterDto } from './dto/figure-template-filter.dto';
import { CreateFigureNodeDto } from './dto/create-figure-node.dto';

const FAMILY_ZONES = new Set<string>([FigureZone.TRONC, FigureZone.BASE]);

// ─── Response interfaces ────────────────────────────────────────────────────

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
  ringLevel: number | null;
  originNodeId: string | null;
  metadata: Record<string, unknown>;
}

export interface FigureTemplateListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hasPinya: boolean;
  direction: number;
  variantOrder: number;
  familyId: string | null;
  familyName: string | null;
  nodeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FigureTemplateDetailItem extends FigureTemplateListItem {
  metadata: Record<string, unknown>;
  nodes: FigureNodeItem[];
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class FigureTemplateService {
  constructor(
    @InjectRepository(FigureFamily)
    private readonly familyRepository: Repository<FigureFamily>,
    @InjectRepository(FigureTemplate)
    private readonly templateRepository: Repository<FigureTemplate>,
    @InjectRepository(FigureNode)
    private readonly nodeRepository: Repository<FigureNode>,
    @InjectRepository(FigureFamilyNode)
    private readonly familyNodeRepository: Repository<FigureFamilyNode>,
    @InjectRepository(CompositionSlot)
    private readonly compositionSlotRepository: Repository<CompositionSlot>,
    @InjectRepository(FigureInstance)
    private readonly figureInstanceRepository: Repository<FigureInstance>,
  ) {}

  async findAll(
    filters: FigureTemplateFilterDto,
  ): Promise<{ data: FigureTemplateListItem[]; total: number }> {
    const { search, hasPinya, familyId, page = 1, limit = 25 } = filters;

    const qb = this.templateRepository
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.family', 'family')
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

    if (familyId !== undefined) {
      qb.andWhere('family.id = :familyId', { familyId });
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
      relations: ['nodes', 'family'],
    });

    if (!template) {
      throw new NotFoundException(`FigureTemplate with ID ${id} not found`);
    }

    const familyNodes = await this.loadFamilyNodes(template.family?.id);

    return toDetailItem(template, familyNodes);
  }

  async create(dto: CreateFigureTemplateDto): Promise<FigureTemplateDetailItem> {
    const family = await this.familyRepository.findOne({ where: { id: dto.familyId } });
    if (!family) {
      throw new NotFoundException(`FigureFamily with ID ${dto.familyId} not found`);
    }

    await this.assertSlugAvailable(dto.slug);

    const variantOrder = dto.variantOrder ?? (await this.nextVariantOrder(family.id));

    const template = this.templateRepository.create({
      family,
      variantOrder,
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

    if (dto.deriveFromTemplateId) {
      await this.deriveNodes(saved!, dto.deriveFromTemplateId);
    } else if (dto.nodes && dto.nodes.length > 0) {
      const familyDtos = dto.nodes.filter((n) => FAMILY_ZONES.has(n.zone));
      const templateDtos = dto.nodes.filter((n) => !FAMILY_ZONES.has(n.zone));

      if (templateDtos.length > 0) {
        await this.createNodes(saved!, templateDtos);
      }

      if (familyDtos.length > 0) {
        const existingCount = await this.familyNodeRepository.count({
          where: { family: { id: family.id } },
        });
        if (existingCount === 0) {
          await this.createFamilyNodes(family, familyDtos);
        }
      }
    }

    return this.findOne(saved!.id);
  }

  async update(id: string, dto: UpdateFigureTemplateDto): Promise<FigureTemplateDetailItem> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['nodes', 'family'],
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
    if (dto.variantOrder !== undefined) template.variantOrder = dto.variantOrder;
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
        `No es pot esborrar: s'utilitza en ${slotCount} composició/composicions.`,
      );
    }

    const instanceCount = await this.figureInstanceRepository.count({
      where: { figureTemplate: { id } },
    });

    if (instanceCount > 0) {
      throw new ConflictException(
        `No es pot esborrar: hi ha ${instanceCount} instància/instàncies que fan servir aquest template.`,
      );
    }

    await this.templateRepository.remove(template);
  }

  async duplicate(id: string): Promise<FigureTemplateDetailItem> {
    const original = await this.templateRepository.findOne({
      where: { id },
      relations: ['nodes', 'family'],
    });

    if (!original) {
      throw new NotFoundException(`FigureTemplate with ID ${id} not found`);
    }

    const variantOrder = original.family
      ? await this.nextVariantOrder(original.family.id)
      : original.variantOrder + 1;

    const copy = this.templateRepository.create({
      family: original.family,
      variantOrder,
      name: `${original.name} (còpia)`,
      slug: `${original.slug}-copia-${Date.now()}`,
      description: original.description,
      hasPinya: original.hasPinya,
      direction: original.direction,
      metadata: original.metadata,
    });

    const savedCopy = await this.templateRepository.save(copy);

    // Only copy PINYA/direction nodes — TRONC/BASE are shared at family level
    const pinyaNodes = (original.nodes ?? []).filter((n) => !FAMILY_ZONES.has(n.zone));
    if (pinyaNodes.length > 0) {
      await this.createNodes(savedCopy, pinyaNodes.map(nodeToCreateDto));
    }

    return this.findOne(savedCopy.id);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async loadFamilyNodes(familyId?: string): Promise<FigureFamilyNode[]> {
    if (!familyId) return [];
    return this.familyNodeRepository.find({
      where: { family: { id: familyId } },
      order: { z: 'ASC', sortOrder: 'ASC' },
    });
  }

  private async nextVariantOrder(familyId: string): Promise<number> {
    const result = await this.templateRepository
      .createQueryBuilder('t')
      .select('MAX(t.variantOrder)', 'max')
      .where('t.familyId = :familyId', { familyId })
      .getRawOne<{ max: number | null }>();
    return (result?.max ?? 0) + 1;
  }

  /**
   * Derives nodes from a source template into a new target template.
   * Only copies PINYA/direction nodes — TRONC/BASE are inherited from the shared family.
   * Sets originNodeId to trace the root ancestor lineage.
   */
  private async deriveNodes(target: FigureTemplate, sourceTemplateId: string): Promise<void> {
    const source = await this.templateRepository.findOne({
      where: { id: sourceTemplateId },
      relations: ['nodes'],
    });

    if (!source || !source.nodes) return;

    const nodesToDerive = source.nodes.filter((n) => !FAMILY_ZONES.has(n.zone));
    if (nodesToDerive.length === 0) return;

    const derived = nodesToDerive.map((node) =>
      this.nodeRepository.create({
        template: target,
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
        ringLevel: node.ringLevel,
        originNodeId: node.originNodeId ?? node.id,
        metadata: node.metadata,
      }),
    );

    await this.nodeRepository.save(derived);
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.templateRepository.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `The slug "${slug}" is already in use by another figure template`,
      );
    }
  }

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
        ringLevel: dto.ringLevel ?? null,
        originNodeId: dto.originNodeId ?? null,
        metadata: dto.metadata ?? {},
      }),
    );
    await this.nodeRepository.save(nodes);
  }

  private async createFamilyNodes(
    family: FigureFamily,
    dtos: CreateFigureNodeDto[],
  ): Promise<void> {
    const nodes = dtos.map((dto) =>
      this.familyNodeRepository.create({
        family,
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
        ringLevel: dto.ringLevel ?? null,
        metadata: dto.metadata ?? {},
      }),
    );
    await this.familyNodeRepository.save(nodes);
  }

  /**
   * Orchestrates node sync: routes TRONC/BASE to figure_family_nodes,
   * everything else stays in figure_nodes (template level).
   */
  private async syncNodes(
    template: FigureTemplate,
    incomingDtos: CreateFigureNodeDto[],
  ): Promise<void> {
    const familyDtos = incomingDtos.filter((dto) => FAMILY_ZONES.has(dto.zone));
    const templateDtos = incomingDtos.filter((dto) => !FAMILY_ZONES.has(dto.zone));

    await this.syncTemplateLevelNodes(template, templateDtos);

    if (template.family) {
      await this.syncFamilyNodes(template.family, familyDtos);
    }
  }

  /**
   * Upsert strategy for template-level (PINYA/direction) nodes.
   * Nodes with matching IDs are updated, unknown IDs create new nodes,
   * existing nodes absent from the incoming list are deleted.
   */
  private async syncTemplateLevelNodes(
    template: FigureTemplate,
    incomingDtos: CreateFigureNodeDto[],
  ): Promise<void> {
    const existingNodes = template.nodes ?? [];
    const existingById = new Map(existingNodes.map((n) => [n.id, n]));

    const toUpdate: FigureNode[] = [];
    const toCreate: CreateFigureNodeDto[] = [];
    const incomingIds = new Set<string>();

    for (const dto of incomingDtos) {
      if (dto.id && existingById.has(dto.id)) {
        const node = existingById.get(dto.id)!;
        node.label = dto.label;
        node.zone = dto.zone;
        node.positionType = dto.positionType ?? null;
        node.x = dto.x;
        node.y = dto.y;
        node.z = dto.z ?? 0;
        node.width = dto.width;
        node.height = dto.height;
        node.rotation = dto.rotation ?? 0;
        node.color = dto.color ?? null;
        node.shape = dto.shape;
        node.sortOrder = dto.sortOrder ?? 0;
        node.climbPath = dto.climbPath ?? null;
        node.ringLevel = dto.ringLevel ?? null;
        node.originNodeId = dto.originNodeId ?? node.originNodeId;
        node.metadata = dto.metadata ?? {};
        toUpdate.push(node);
        incomingIds.add(dto.id);
      } else {
        toCreate.push(dto);
      }
    }

    const toDeleteIds = existingNodes
      .filter((n) => !incomingIds.has(n.id))
      .map((n) => n.id);

    if (toUpdate.length > 0) await this.nodeRepository.save(toUpdate);
    if (toCreate.length > 0) await this.createNodes(template, toCreate);
    if (toDeleteIds.length > 0) await this.nodeRepository.delete({ id: In(toDeleteIds) });
  }

  /**
   * Upsert strategy for family-level (TRONC/BASE) nodes.
   * Shared across all variants of the family.
   */
  private async syncFamilyNodes(
    family: FigureFamily,
    incomingDtos: CreateFigureNodeDto[],
  ): Promise<void> {
    const existingNodes = await this.familyNodeRepository.find({
      where: { family: { id: family.id } },
    });
    const existingById = new Map(existingNodes.map((n) => [n.id, n]));

    const toUpdate: FigureFamilyNode[] = [];
    const toCreate: CreateFigureNodeDto[] = [];
    const incomingIds = new Set<string>();

    for (const dto of incomingDtos) {
      if (dto.id && existingById.has(dto.id)) {
        const node = existingById.get(dto.id)!;
        node.label = dto.label;
        node.zone = dto.zone;
        node.positionType = dto.positionType ?? null;
        node.x = dto.x;
        node.y = dto.y;
        node.z = dto.z ?? 0;
        node.width = dto.width;
        node.height = dto.height;
        node.rotation = dto.rotation ?? 0;
        node.color = dto.color ?? null;
        node.shape = dto.shape;
        node.sortOrder = dto.sortOrder ?? 0;
        node.climbPath = dto.climbPath ?? null;
        node.ringLevel = dto.ringLevel ?? null;
        node.metadata = dto.metadata ?? {};
        toUpdate.push(node);
        incomingIds.add(dto.id);
      } else {
        toCreate.push(dto);
      }
    }

    const toDeleteIds = existingNodes
      .filter((n) => !incomingIds.has(n.id))
      .map((n) => n.id);

    if (toUpdate.length > 0) await this.familyNodeRepository.save(toUpdate);
    if (toCreate.length > 0) await this.createFamilyNodes(family, toCreate);
    if (toDeleteIds.length > 0) await this.familyNodeRepository.delete({ id: In(toDeleteIds) });
  }
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function nodeToCreateDto(node: FigureNode): CreateFigureNodeDto {
  return {
    id: node.id,
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
    ringLevel: node.ringLevel ?? undefined,
    originNodeId: node.originNodeId ?? undefined,
    metadata: node.metadata,
  };
}

function templateNodeToItem(node: FigureNode): FigureNodeItem {
  return {
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
    ringLevel: node.ringLevel,
    originNodeId: node.originNodeId,
    metadata: node.metadata,
  };
}

function familyNodeToItem(node: FigureFamilyNode): FigureNodeItem {
  return {
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
    ringLevel: node.ringLevel,
    originNodeId: null, // Family nodes are always the canonical source
    metadata: node.metadata,
  };
}

function toListItem(
  template: FigureTemplate & { nodeCount?: number },
): FigureTemplateListItem {
  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description,
    hasPinya: template.hasPinya,
    direction: template.direction,
    variantOrder: template.variantOrder,
    familyId: template.family?.id ?? null,
    familyName: template.family?.name ?? null,
    nodeCount: (template as unknown as { nodeCount: number }).nodeCount ?? 0,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function toDetailItem(
  template: FigureTemplate,
  familyNodes: FigureFamilyNode[] = [],
): FigureTemplateDetailItem {
  return {
    ...toListItem(template),
    metadata: template.metadata,
    nodes: [
      ...(template.nodes ?? []).map(templateNodeToItem),
      ...familyNodes.map(familyNodeToItem),
    ],
  };
}
