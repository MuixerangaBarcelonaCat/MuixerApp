import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { Rengla } from './entities/rengla.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { CreateFigureTemplateDto } from './dto/create-figure-template.dto';
import { UpdateFigureTemplateDto } from './dto/update-figure-template.dto';
import { FigureTemplateFilterDto } from './dto/figure-template-filter.dto';
import { CreateFigureNodeDto } from './dto/create-figure-node.dto';
import { CreateRenglaDto } from './dto/create-rengla.dto';
import { SaveFromInstanceDto } from './dto/save-from-instance.dto';
import { FigureZone, sanitizeStandsOn } from '@muixer/shared';
import { computeTroncProfileFromNodes, loadTroncProfiles } from './tronc-profile.util';

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
  climbIndicator: string | null;
  ringLevel: number | null;
  originNodeId: string | null;
  renglaId: string | null;
  renglaPosition: number | null;
  standsOnNodeIds: string[];
  metadata: Record<string, unknown>;
}

interface RenglaItem {
  id: string;
  name: string;
  sortOrder: number;
}

interface FigureTemplateListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hasPinya: boolean;
  direction: number;
  nodeCount: number;
  renglaCount: number;
  /** People per tronc/base floor, bottom-to-top (index 0 = bases). Pinya is never included. */
  troncProfile: number[];
  createdAt: Date;
  updatedAt: Date;
}

interface FigureTemplateDetailItem extends FigureTemplateListItem {
  metadata: Record<string, unknown>;
  nodes: FigureNodeItem[];
  rengles: RenglaItem[];
  adHocInstanceCount: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class FigureTemplateService {
  private readonly logger = new Logger(FigureTemplateService.name);

  constructor(
    @InjectRepository(FigureTemplate)
    private readonly templateRepository: Repository<FigureTemplate>,
    @InjectRepository(FigureNode)
    private readonly nodeRepository: Repository<FigureNode>,
    @InjectRepository(Rengla)
    private readonly renglaRepository: Repository<Rengla>,
    @InjectRepository(FigureInstance)
    private readonly figureInstanceRepository: Repository<FigureInstance>,
    @InjectRepository(InstanceNode)
    private readonly instanceNodeRepository: Repository<InstanceNode>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    filters: FigureTemplateFilterDto,
  ): Promise<{ data: FigureTemplateListItem[]; total: number }> {
    const { search, page = 1, limit = 25 } = filters;

    const qb = this.templateRepository
      .createQueryBuilder('template')
      .loadRelationCountAndMap('template.nodeCount', 'template.nodes')
      .loadRelationCountAndMap('template.renglaCount', 'template.rengles')
      .loadRelationCountAndMap(
        'template.pinyaNodeCount',
        'template.nodes',
        'pinyaNode',
        (qb) => qb.andWhere("pinyaNode.zone = 'PINYA'"),
      );

    if (search) {
      qb.andWhere(
        '(unaccent(template.name) ILIKE unaccent(:search) OR template.slug ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const templates = await qb
      .orderBy('unaccent(lower(template.name))', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const troncProfiles = await loadTroncProfiles(this.nodeRepository, templates.map((t) => t.id));

    return {
      data: templates.map((t) => toListItem(t, troncProfiles.get(t.id) ?? [])),
      total,
    };
  }

  async findOne(id: string): Promise<FigureTemplateDetailItem> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['nodes', 'rengles'],
    });

    if (!template) {
      throw new NotFoundException(`FigureTemplate with ID ${id} not found`);
    }

    const adHocInstanceCount = await this.instanceNodeRepository
      .createQueryBuilder('inode')
      .innerJoin('inode.figureInstance', 'fi')
      .where('fi.figureTemplateId = :templateId', { templateId: id })
      .andWhere('fi.snapshotted = true')
      .andWhere('inode.isAdHoc = true')
      .select('COUNT(DISTINCT fi.id)', 'count')
      .getRawOne()
      .then((r) => parseInt(r?.count ?? '0', 10));

    return toDetailItem(template, adHocInstanceCount);
  }

  async create(dto: CreateFigureTemplateDto): Promise<FigureTemplateDetailItem> {
    const name = dto.name.trim();
    await this.assertNameAvailable(name);
    const slug = await this.generateUniqueSlug(this.slugify(name));
    const nodes = dto.nodes ? resolveStandsOn(dto.nodes) : [];

    const template = this.templateRepository.create({
      name,
      slug,
      description: dto.description ?? null,
      direction: dto.direction ?? 0,
      metadata: dto.metadata ?? {},
    });

    let saved: FigureTemplate;
    try {
      saved = await this.templateRepository.save(template);
    } catch (err) {
      this.handleDbError(err);
    }

    if (nodes.length > 0) {
      await this.createNodes(saved!, nodes);
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

    const nodes = dto.nodes && resolveStandsOn(dto.nodes, template.nodes ?? []);

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      await this.assertNameAvailable(trimmedName, id);
      template.name = trimmedName;
      template.slug = await this.generateUniqueSlug(this.slugify(trimmedName), id);
    }
    if (dto.description !== undefined) template.description = dto.description ?? null;
    if (dto.direction !== undefined) template.direction = dto.direction;
    if (dto.metadata !== undefined) template.metadata = dto.metadata ?? {};

    // Name/nodes/rengles writes must commit or roll back together: otherwise a failure
    // partway through leaves the template renamed but with stale nodes, or nodes synced
    // but rengles left inconsistent (see SM-11).
    await this.dataSource.transaction(async (manager) => {
      const templateRepo = manager.getRepository(FigureTemplate);
      const nodeRepo = manager.getRepository(FigureNode);
      const renglaRepo = manager.getRepository(Rengla);

      try {
        await templateRepo.save(template);
      } catch (err) {
        this.handleDbError(err);
      }

      if (nodes !== undefined) {
        await this.syncNodes(template, nodes, nodeRepo);
      }

      if (dto.rengles !== undefined) {
        await this.syncRengles(template, dto.rengles, nodeRepo, renglaRepo);
      }
    });

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const template = await this.templateRepository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException(`FigureTemplate with ID ${id} not found`);
    }

    const instanceCount = await this.figureInstanceRepository.count({
      where: { figureTemplate: { id } },
    });

    if (instanceCount > 0) {
      throw new ConflictException(
        `No es pot esborrar: hi ha ${instanceCount} instàncies que fan servir aquesta plantilla.`,
      );
    }

    await this.templateRepository.remove(template);
  }

  async duplicate(id: string): Promise<FigureTemplateDetailItem> {
    const original = await this.templateRepository.findOne({
      where: { id },
      relations: ['nodes', 'rengles'],
    });

    if (!original) {
      throw new NotFoundException(`FigureTemplate with ID ${id} not found`);
    }

    const name = await this.generateCopyName(original.name);
    const slug = await this.generateUniqueSlug(this.slugify(name));

    // Template + rengles + nodes must commit or roll back together (see SM-11).
    let savedCopy!: FigureTemplate;
    await this.dataSource.transaction(async (manager) => {
      const templateRepo = manager.getRepository(FigureTemplate);

      savedCopy = await templateRepo.save(
        templateRepo.create({
          name,
          slug,
          description: original.description,
          direction: original.direction,
          metadata: original.metadata,
        }),
      );

      const renglaIdMap = await this.copyRengles(
        savedCopy,
        original.rengles ?? [],
        manager.getRepository(Rengla),
      );

      const allNodes = original.nodes ?? [];
      if (allNodes.length > 0) {
        // Fresh ids: the originals still belong to the source template.
        const nodeDtos = copyWithFreshIds(
          allNodes.map((n) => ({ sourceId: n.id, dto: nodeToCreateDto(n) })),
        );
        await this.createNodes(
          savedCopy,
          remapRenglaIds(nodeDtos, renglaIdMap),
          manager.getRepository(FigureNode),
        );
      }
    });

    return this.findOne(savedCopy.id);
  }

  // ─── Save from Instance ─────────────────────────────────────────────────────

  private static readonly SAVEABLE_ZONES: string[] = [
    FigureZone.PINYA,
    FigureZone.BASE,
    FigureZone.TRONC,
  ];

  async saveFromInstance(
    templateId: string,
    dto: SaveFromInstanceDto,
  ): Promise<FigureTemplateDetailItem> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId },
      relations: ['nodes', 'rengles'],
    });
    if (!template) {
      throw new NotFoundException(`FigureTemplate with ID ${templateId} not found`);
    }

    const instance = await this.figureInstanceRepository.findOne({
      where: { id: dto.instanceId },
      relations: ['instanceNodes', 'figureTemplate'],
    });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${dto.instanceId} not found`);
    }
    if (instance.figureTemplate?.id !== templateId) {
      throw new BadRequestException('Instance does not belong to this template');
    }
    if (!instance.snapshotted) {
      throw new BadRequestException('Instance is not snapshotted yet');
    }

    const filteredNodes = (instance.instanceNodes ?? []).filter(
      (n) => FigureTemplateService.SAVEABLE_ZONES.includes(n.zone),
    );

    if (filteredNodes.length === 0) {
      throw new BadRequestException('No saveable nodes in this instance');
    }

    // Fresh ids up front so the links can point at the new template nodes, not the instance ones.
    const nodeDtos = copyWithFreshIds(
      filteredNodes.map((n) => ({ sourceId: n.id, dto: this.instanceNodeToCreateDto(n) })),
    );

    if (dto.mode === 'overwrite') {
      // syncNodes issues several dependent writes (update/create/delete); they must
      // commit or roll back together (see SM-11).
      await this.dataSource.transaction(async (manager) => {
        await this.syncNodes(template, nodeDtos, manager.getRepository(FigureNode));
      });
      return this.findOne(templateId);
    }

    // new_version: create a new template
    const versionName = dto.name?.trim() || await this.suggestVersionName(template.name);
    const versionSlug = this.generateSlug(versionName);

    await this.assertSlugAvailable(versionSlug);

    // New template + copied rengles + copied nodes must commit or roll back together —
    // a failure partway through would otherwise leave an orphan half-built version (see SM-11).
    let savedTemplate!: FigureTemplate;
    await this.dataSource.transaction(async (manager) => {
      const templateRepo = manager.getRepository(FigureTemplate);
      const renglaRepo = manager.getRepository(Rengla);
      const nodeRepo = manager.getRepository(FigureNode);

      const newTemplate = templateRepo.create({
        name: versionName,
        slug: versionSlug,
        description: template.description,
        direction: template.direction,
        metadata: template.metadata ?? {},
      });

      try {
        savedTemplate = await templateRepo.save(newTemplate);
      } catch (err) {
        this.handleDbError(err);
      }

      const renglaIdMap = await this.copyRengles(savedTemplate, template.rengles ?? [], renglaRepo);

      await this.createNodes(savedTemplate, remapRenglaIds(nodeDtos, renglaIdMap), nodeRepo);
    });

    return this.findOne(savedTemplate.id);
  }

  async suggestVersionName(baseName: string): Promise<string> {
    const pattern = baseName.replace(/ v\d+$/, '');
    const existing = await this.templateRepository
      .createQueryBuilder('t')
      .where("t.name LIKE :pattern", { pattern: `${pattern} v%` })
      .getMany();

    let maxVersion = 1;
    for (const t of existing) {
      const match = t.name.match(/ v(\d+)$/);
      if (match) {
        maxVersion = Math.max(maxVersion, parseInt(match[1], 10));
      }
    }
    return `${pattern} v${maxVersion + 1}`;
  }

  private instanceNodeToCreateDto(n: InstanceNode): CreateFigureNodeDto {
    return {
      label: n.label,
      zone: n.zone,
      positionType: n.positionType ?? undefined,
      x: n.x,
      y: n.y,
      z: n.z,
      width: n.width,
      height: n.height,
      rotation: n.rotation,
      color: n.color ?? undefined,
      shape: n.shape,
      sortOrder: n.sortOrder,
      climbIndicator: n.climbIndicator ?? undefined,
      ringLevel: n.ringLevel ?? undefined,
      renglaId: n.renglaId ?? undefined,
      renglaPosition: n.renglaPosition ?? undefined,
      standsOnNodeIds: n.standsOnNodeIds ?? [],
      metadata: n.metadata,
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.templateRepository.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `The slug "${slug}" is already in use by another figure template`,
      );
    }
  }

  private async assertNameAvailable(name: string, excludeId?: string): Promise<void> {
    const existing = await this.templateRepository.findOne({ where: { name } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `The name "${name}" is already in use by another figure template`,
      );
    }
  }

  /**
   * Builds the name for a duplicated template: "X (còpia)", or "X (còpia 2)", "X (còpia 3)"...
   * if that's already taken. Strips any existing "(còpia)"/"(còpia N)" suffix first, so
   * duplicating a template that is itself already a copy doesn't stack suffixes.
   */
  private async generateCopyName(originalName: string): Promise<string> {
    const base = originalName.replace(/\s*\(còpia(?:\s+\d+)?\)$/i, '');
    let suffix = 1;
    while (true) {
      const candidate = suffix === 1 ? `${base} (còpia)` : `${base} (còpia ${suffix})`;
      const existing = await this.templateRepository.findOne({ where: { name: candidate } });
      if (!existing) return candidate;
      suffix++;
    }
  }

  private async generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let candidate = baseSlug;
    let suffix = 2;
    while (true) {
      const existing = await this.templateRepository.findOne({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${baseSlug}-${suffix}`;
      suffix++;
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private handleDbError(err: unknown): never {
    const pgErr = err as { code?: string; detail?: string };
    if (pgErr?.code === '23505') {
      const nameMatch = pgErr.detail?.match(/Key \(name\)=\(([^)]+)\)/);
      if (nameMatch) {
        throw new ConflictException(
          `The name "${nameMatch[1]}" is already in use by another figure template`,
        );
      }
      const idMatch = pgErr.detail?.match(/Key \(id\)=\(([^)]+)\)/);
      if (idMatch) {
        throw new ConflictException(`The node id "${idMatch[1]}" is already in use`);
      }
      const slugMatch = pgErr.detail?.match(/Key \(slug\)=\(([^)]+)\)/);
      if (slugMatch) {
        throw new ConflictException(
          `The slug "${slugMatch[1]}" is already in use by another figure template`,
        );
      }
      throw new ConflictException('A figure template with these values already exists');
    }
    this.logger.error(err);
    throw new InternalServerErrorException('Unexpected database error');
  }

  /**
   * Copies `sources` into `template` with fresh ids and returns the source → copy id map, so the
   * copied nodes can be pointed at their own template's rengles instead of the source's.
   */
  private async copyRengles(
    template: FigureTemplate,
    sources: Rengla[],
    renglaRepo: Repository<Rengla>,
  ): Promise<Map<string, string>> {
    const idMap = new Map(sources.map((r) => [r.id, randomUUID()]));
    if (sources.length > 0) {
      await renglaRepo.save(
        sources.map((r) =>
          renglaRepo.create({ id: idMap.get(r.id), template, name: r.name, sortOrder: r.sortOrder }),
        ),
      );
    }
    return idMap;
  }

  private async createNodes(
    template: FigureTemplate,
    dtos: CreateFigureNodeDto[],
    nodeRepo: Repository<FigureNode> = this.nodeRepository,
  ): Promise<void> {
    const nodes = dtos.map((dto) =>
      nodeRepo.create({
        // Keep the client's id: the editor references nodes by it between autosaves.
        ...(dto.id ? { id: dto.id } : {}),
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
        climbIndicator: dto.climbIndicator ?? null,
        ringLevel: dto.ringLevel ?? null,
        originNodeId: dto.originNodeId ?? null,
        renglaId: dto.renglaId ?? null,
        renglaPosition: dto.renglaPosition ?? null,
        standsOnNodeIds: dto.standsOnNodeIds ?? [],
        metadata: dto.metadata ?? {},
      }),
    );
    try {
      await nodeRepo.save(nodes);
    } catch (err) {
      this.handleDbError(err);
    }
  }

  /**
   * Upsert strategy for all nodes (PINYA, TRONC, BASE — all in figure_nodes now).
   * Nodes with matching IDs are updated, unknown IDs create new nodes,
   * existing nodes absent from the incoming list are deleted.
   */
  private async syncNodes(
    template: FigureTemplate,
    incomingDtos: CreateFigureNodeDto[],
    nodeRepo: Repository<FigureNode> = this.nodeRepository,
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
        node.climbIndicator = dto.climbIndicator ?? null;
        node.ringLevel = dto.ringLevel ?? null;
        if (dto.originNodeId !== undefined) node.originNodeId = dto.originNodeId;
        if (dto.renglaId !== undefined) node.renglaId = dto.renglaId;
        if (dto.renglaPosition !== undefined) node.renglaPosition = dto.renglaPosition;
        if (dto.standsOnNodeIds !== undefined) node.standsOnNodeIds = dto.standsOnNodeIds;
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

    if (toUpdate.length > 0) await nodeRepo.save(toUpdate);
    if (toCreate.length > 0) await this.createNodes(template, toCreate, nodeRepo);
    if (toDeleteIds.length > 0) await nodeRepo.delete({ id: In(toDeleteIds) });
  }

  private async syncRengles(
    template: FigureTemplate,
    incomingDtos: CreateRenglaDto[],
    nodeRepo: Repository<FigureNode> = this.nodeRepository,
    renglaRepo: Repository<Rengla> = this.renglaRepository,
  ): Promise<void> {
    const existingRengles = await renglaRepo.find({
      where: { template: { id: template.id } },
    });
    const existingById = new Map(existingRengles.map((r) => [r.id, r]));

    const toUpdate: Rengla[] = [];
    const toCreate: Rengla[] = [];
    const incomingIds = new Set<string>();

    for (let i = 0; i < incomingDtos.length; i++) {
      const dto = incomingDtos[i];
      if (dto.id && existingById.has(dto.id)) {
        const rengla = existingById.get(dto.id)!;
        rengla.name = dto.name ?? rengla.name ?? `Rengla ${i + 1}`;
        rengla.sortOrder = dto.sortOrder ?? rengla.sortOrder;
        toUpdate.push(rengla);
        incomingIds.add(dto.id);
      } else {
        toCreate.push(
          renglaRepo.create({
            ...(dto.id ? { id: dto.id } : {}),
            template,
            name: dto.name || `Rengla ${i + 1}`,
            sortOrder: dto.sortOrder ?? i,
          }),
        );
      }
    }

    const toDeleteIds = existingRengles
      .filter((r) => !incomingIds.has(r.id))
      .map((r) => r.id);

    if (toUpdate.length > 0) await renglaRepo.save(toUpdate);
    if (toCreate.length > 0) await renglaRepo.save(toCreate);

    if (toDeleteIds.length > 0) {
      await nodeRepo
        .createQueryBuilder()
        .update(FigureNode)
        .set({ renglaId: null, renglaPosition: null })
        .where('renglaId IN (:...ids)', { ids: toDeleteIds })
        .andWhere('templateId = :templateId', { templateId: template.id })
        .execute();

      await renglaRepo.delete({ id: In(toDeleteIds) });
    }
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
    climbIndicator: node.climbIndicator ?? undefined,
    ringLevel: node.ringLevel ?? undefined,
    originNodeId: node.originNodeId ?? undefined,
    renglaId: node.renglaId ?? undefined,
    renglaPosition: node.renglaPosition ?? undefined,
    standsOnNodeIds: node.standsOnNodeIds ?? [],
    metadata: node.metadata,
  };
}

function nodeToItem(node: FigureNode): FigureNodeItem {
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
    climbIndicator: node.climbIndicator,
    ringLevel: node.ringLevel,
    originNodeId: node.originNodeId,
    renglaId: node.renglaId,
    renglaPosition: node.renglaPosition,
    standsOnNodeIds: node.standsOnNodeIds ?? [],
    metadata: node.metadata,
  };
}

/**
 * Checks the `standsOnNodeIds` the client sent against the payload itself — it is the template's
 * full node list, so a link to a node left out of it is as invalid as one to the wrong floor —
 * and throws naming the first offending node. An omitted field keeps the stored value, pruned of
 * whatever the payload no longer satisfies (a deleted or moved node), so older clients that don't
 * send it never trip the validation.
 */
function resolveStandsOn(
  dtos: CreateFigureNodeDto[],
  existingNodes: FigureNode[] = [],
): CreateFigureNodeDto[] {
  const storedById = new Map(existingNodes.map((n) => [n.id, n.standsOnNodeIds ?? []]));
  const resolved = sanitizeStandsOn(dtos.map((dto, i) => toSupportNode(dto, i, storedById)));

  dtos.forEach((dto, i) => {
    const sent = dto.standsOnNodeIds;
    if (sent && resolved[i].standsOnNodeIds.length !== new Set(sent).size) {
      throw new BadRequestException(
        `Node "${dto.label}" can only stand on base or tronc nodes of the floor directly below it`,
      );
    }
  });

  return dtos.map((dto, i) => ({ ...dto, standsOnNodeIds: resolved[i].standsOnNodeIds }));
}

/**
 * Gives each copied node a fresh id and rewrites `standsOnNodeIds` from the source ids to the
 * copies' — the remap the duplicate and save-from-instance paths need, since the source ids
 * still belong to another template or instance. Links that don't survive the copy are dropped.
 */
function copyWithFreshIds(
  sources: { sourceId: string; dto: CreateFigureNodeDto }[],
): CreateFigureNodeDto[] {
  const withIds = sources.map((s) => ({ ...s, id: randomUUID() }));
  const idMap = new Map(withIds.map((s) => [s.sourceId, s.id]));
  const copies = withIds.map(({ id, dto }) => ({
    ...dto,
    id,
    standsOnNodeIds: (dto.standsOnNodeIds ?? []).flatMap((id) => idMap.get(id) ?? []),
  }));
  const sanitized = sanitizeStandsOn(copies.map((dto, i) => toSupportNode(dto, i)));
  return copies.map((dto, i) => ({ ...dto, standsOnNodeIds: sanitized[i].standsOnNodeIds }));
}

/** Rewrites each node's `renglaId` through `idMap`; a link to a rengla that wasn't copied is dropped. */
function remapRenglaIds(
  dtos: CreateFigureNodeDto[],
  idMap: Map<string, string>,
): CreateFigureNodeDto[] {
  return dtos.map((dto) => ({
    ...dto,
    renglaId: dto.renglaId ? (idMap.get(dto.renglaId) ?? null) : null,
  }));
}

function toSupportNode(
  dto: CreateFigureNodeDto,
  index: number,
  storedById: Map<string, string[]> = new Map(),
) {
  return {
    // A node with no id yet can't be referenced, but still needs a unique key to hold links.
    id: dto.id ?? `new:${index}`,
    zone: dto.zone,
    z: dto.z ?? 0,
    standsOnNodeIds: dto.standsOnNodeIds ?? (dto.id ? storedById.get(dto.id) : undefined) ?? [],
  };
}

function renglaToItem(rengla: Rengla): RenglaItem {
  return {
    id: rengla.id,
    name: rengla.name ?? `Rengla ${rengla.sortOrder + 1}`,
    sortOrder: rengla.sortOrder,
  };
}

function toListItem(
  template: FigureTemplate & { nodeCount?: number; renglaCount?: number; pinyaNodeCount?: number },
  troncProfile: number[] = [],
): FigureTemplateListItem {
  const t = template as unknown as { nodeCount: number; renglaCount: number; pinyaNodeCount: number };
  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description,
    hasPinya: (t.pinyaNodeCount ?? 0) > 0,
    direction: template.direction,
    nodeCount: t.nodeCount ?? 0,
    renglaCount: t.renglaCount ?? 0,
    troncProfile,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function toDetailItem(
  template: FigureTemplate,
  adHocInstanceCount = 0,
): FigureTemplateDetailItem {
  return {
    ...toListItem(template, computeTroncProfileFromNodes(template.nodes ?? [])),
    hasPinya: (template.nodes ?? []).some((n) => n.zone === FigureZone.PINYA),
    metadata: template.metadata,
    nodes: (template.nodes ?? []).map(nodeToItem),
    rengles: (template.rengles ?? []).map(renglaToItem),
    adHocInstanceCount,
  };
}
