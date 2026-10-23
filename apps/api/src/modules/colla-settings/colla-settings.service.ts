import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditAction,
  CollaSettings,
  DEFAULT_COLLA_SETTINGS,
  PublicCollaSettings,
  UpdateCollaSettings,
} from '@muixer/shared';
import { AuditService } from '../audit/audit.service';
import { Tag } from '../tag/tag.entity';
import { CollaSettingsEntity } from './colla-settings.entity';
import { toCollaSettings, toCollaSettingsColumns } from './colla-settings.mapper';

/** How long a read is reused. Updates refresh it at once; this only bounds staleness across API instances. */
const CACHE_TTL_MS = 60_000;

export interface SettingsActor {
  userId: string;
  ipAddress: string | null;
}

type FieldChanges = Partial<Record<keyof CollaSettings, { from: unknown; to: unknown }>>;

@Injectable()
export class CollaSettingsService {
  private cached: { row: CollaSettingsEntity; readAt: number } | null = null;
  private pending: Promise<CollaSettingsEntity> | null = null;

  constructor(
    @InjectRepository(CollaSettingsEntity)
    private readonly repo: Repository<CollaSettingsEntity>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<CollaSettings> {
    return toCollaSettings(await this.row());
  }

  async getPublic(): Promise<PublicCollaSettings> {
    const { collaName } = await this.get();
    return { collaName };
  }

  async update(patch: UpdateCollaSettings, actor: SettingsActor): Promise<CollaSettings> {
    const row = await this.row();
    const previous = toCollaSettings(row);
    const next: CollaSettings = { ...previous, ...patch };

    const changes = diff(previous, next);
    if (Object.keys(changes).length === 0) return previous;

    assertThresholdsOrdered(next);
    if (changes.defaultTagId && next.defaultTagId !== null && !(await this.tagRepo.existsBy({ id: next.defaultTagId }))) {
      throw new NotFoundException("No s'ha trobat l'etiqueta.");
    }

    const saved = await this.repo.save({ ...row, ...toCollaSettingsColumns(next) });
    this.cached = { row: saved, readAt: Date.now() };

    await this.audit.record({
      actorUserId: actor.userId,
      ipAddress: actor.ipAddress,
      action: AuditAction.COLLA_SETTINGS_UPDATED,
      targetType: 'CollaSettings',
      targetId: saved.id,
      metadata: { changes },
    });

    return toCollaSettings(saved);
  }

  private async row(): Promise<CollaSettingsEntity> {
    if (this.cached && Date.now() - this.cached.readAt <= CACHE_TTL_MS) return this.cached.row;

    this.pending ??= this.load().finally(() => (this.pending = null));
    const row = await this.pending;
    this.cached = { row, readAt: Date.now() };
    return row;
  }

  /** The stored row; stores the defaults first when there is none (e.g. a database wiped by tests). */
  private async load(): Promise<CollaSettingsEntity> {
    const [row] = await this.repo.find({ take: 1 });
    if (row) return row;

    try {
      return await this.repo.save(this.repo.create(toCollaSettingsColumns(DEFAULT_COLLA_SETTINGS)));
    } catch {
      // Another request inserted it first; the singleton index refused this one.
      const [inserted] = await this.repo.find({ take: 1 });
      return inserted;
    }
  }
}

function diff(previous: CollaSettings, next: CollaSettings): FieldChanges {
  const changes: FieldChanges = {};
  for (const key of Object.keys(next) as (keyof CollaSettings)[]) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      changes[key] = { from: previous[key], to: next[key] };
    }
  }
  return changes;
}

function assertThresholdsOrdered({ troncHeightThresholds: { floor, support } }: CollaSettings): void {
  if (floor.warning >= floor.error || support.warning >= support.error) {
    throw new BadRequestException("El llindar d'avís ha de ser menor que el d'error.");
  }
}
