import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LegalDocumentType } from '@muixer/shared';
import { LegalDocument } from './legal-document.entity';
import { PublishLegalDocumentDto } from './dto/publish-legal-document.dto';

@Injectable()
export class LegalDocumentService {
  constructor(
    @InjectRepository(LegalDocument)
    private readonly repo: Repository<LegalDocument>,
    private readonly dataSource: DataSource,
  ) {}

  /** All documents, newest version first per type (for the admin editor). */
  findAll(): Promise<LegalDocument[]> {
    return this.repo.find({ order: { type: 'ASC', version: 'DESC' } });
  }

  /** The currently-published document of a type. Throws if none is active. */
  async findActive(type: LegalDocumentType): Promise<LegalDocument> {
    const doc = await this.repo.findOne({ where: { type, isActive: true } });
    if (!doc) {
      throw new NotFoundException(`No hi ha cap document actiu de tipus ${type}`);
    }
    return doc;
  }

  /**
   * The "consent watermark": the highest version of a type with `requiresConsent = true`, or null
   * when none has ever required it. This — NOT the active version — is what the click-wrap gate
   * compares against, so a correction (published with `requiresConsent: false`) can update the
   * active text without moving the watermark and forcing everyone to re-accept.
   */
  async getConsentVersion(type: LegalDocumentType): Promise<number | null> {
    const doc = await this.repo.findOne({
      where: { type, requiresConsent: true },
      order: { version: 'DESC' },
    });
    return doc?.version ?? null;
  }

  /**
   * Publish a new version of a document type: computes `version = max + 1`, deactivates the
   * current active document of that type and inserts the new one as active — all in one
   * transaction so the "one active per type" invariant never breaks.
   *
   * `dto.requiresConsent` decides whether THIS publish also moves the consent watermark:
   * - `false` (a correction, e.g. a typo fix): the active text updates, nobody is asked to
   *   re-accept.
   * - `true` (a substantive change): everyone who accepted an earlier version must re-accept on
   *   their next login/refresh.
   * `TRANSPARENCY_CLAUSE` is purely informative and never gates anything — `requiresConsent` is
   * forced to `false` for it regardless of what the caller passes.
   */
  async publish(dto: PublishLegalDocumentDto): Promise<LegalDocument> {
    const requiresConsent =
      dto.type === LegalDocumentType.TRANSPARENCY_CLAUSE ? false : !!dto.requiresConsent;

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LegalDocument);
      const latest = await repo.findOne({
        where: { type: dto.type },
        order: { version: 'DESC' },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      await repo.update({ type: dto.type, isActive: true }, { isActive: false });

      const doc = repo.create({
        type: dto.type,
        version: nextVersion,
        content: dto.content,
        isActive: true,
        requiresConsent,
        publishedAt: new Date(),
      });
      return repo.save(doc);
    });
  }
}
