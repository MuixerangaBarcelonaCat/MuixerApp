import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { LegalDocumentType } from '@muixer/shared';
import { LegalDocument } from './legal-document.entity';
import { LegalDocumentService } from './legal-document.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
});

// The transaction manager exposes a scoped repository used by publish().
const makeTxRepo = () => ({
  findOne: jest.fn(),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve({ id: 'new-id', ...data })),
});

describe('LegalDocumentService', () => {
  let service: LegalDocumentService;
  let repo: ReturnType<typeof mockRepo>;
  let txRepo: ReturnType<typeof makeTxRepo>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    txRepo = makeTxRepo();
    dataSource = {
      transaction: jest.fn((cb: (m: unknown) => unknown) =>
        cb({ getRepository: () => txRepo }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalDocumentService,
        { provide: getRepositoryToken(LegalDocument), useFactory: mockRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(LegalDocumentService);
    repo = module.get(getRepositoryToken(LegalDocument));
  });

  describe('findActive', () => {
    it('returns the active document for a type', async () => {
      const doc = { id: '1', type: LegalDocumentType.PRIVACY_POLICY, version: 3, isActive: true };
      repo.findOne.mockResolvedValue(doc);

      const result = await service.findActive(LegalDocumentType.PRIVACY_POLICY);
      expect(result).toBe(doc);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { type: LegalDocumentType.PRIVACY_POLICY, isActive: true },
      });
    });

    it('throws NotFoundException when there is no active document', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findActive(LegalDocumentType.PRIVACY_POLICY)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveVersion', () => {
    it('returns the active version number', async () => {
      repo.findOne.mockResolvedValue({ version: 5, isActive: true });
      await expect(service.getActiveVersion(LegalDocumentType.PRIVACY_POLICY)).resolves.toBe(5);
    });

    it('returns null when there is no active document', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getActiveVersion(LegalDocumentType.PRIVACY_POLICY)).resolves.toBeNull();
    });
  });

  describe('publish', () => {
    it('creates version 1 when no prior document exists', async () => {
      txRepo.findOne.mockResolvedValue(null);

      const result = await service.publish({
        type: LegalDocumentType.PRIVACY_POLICY,
        content: 'text',
      });

      expect(result.version).toBe(1);
      expect(result.isActive).toBe(true);
      expect(txRepo.save).toHaveBeenCalled();
    });

    it('increments the version and deactivates the previous active document', async () => {
      txRepo.findOne.mockResolvedValue({ version: 4 });

      const result = await service.publish({
        type: LegalDocumentType.PRIVACY_POLICY,
        content: 'nova versió',
      });

      expect(result.version).toBe(5);
      // Deactivate the currently-active document of this type before inserting the new one.
      expect(txRepo.update).toHaveBeenCalledWith(
        { type: LegalDocumentType.PRIVACY_POLICY, isActive: true },
        { isActive: false },
      );
    });
  });
});
