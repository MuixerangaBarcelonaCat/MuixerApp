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

  /** Active version number of a type, or null when none is published. Drives the consent gate. */
  async getActiveVersion(type: LegalDocumentType): Promise<number | null> {
    const doc = await this.repo.findOne({ where: { type, isActive: true } });
    return doc?.version ?? null;
  }

  /**
   * Publish a new version of a document type: computes `version = max + 1`, deactivates the
   * current active document of that type and inserts the new one as active — all in one
   * transaction so the "one active per type" invariant never breaks. Publishing a new
   * PRIVACY_POLICY is what re-triggers the click-wrap consent gate for everyone.
   */
  async publish(dto: PublishLegalDocumentDto): Promise<LegalDocument> {
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
        publishedAt: new Date(),
      });
      return repo.save(doc);
    });
  }
}
