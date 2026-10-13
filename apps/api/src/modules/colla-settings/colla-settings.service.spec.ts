import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, CollaSettings, DEFAULT_COLLA_SETTINGS } from '@muixer/shared';
import { AuditService } from '../audit/audit.service';
import { Tag } from '../tag/tag.entity';
import { CollaSettingsEntity } from './colla-settings.entity';
import { toCollaSettingsColumns } from './colla-settings.mapper';
import { CollaSettingsService } from './colla-settings.service';

const storedRow = (overrides: Partial<CollaSettings> = {}): CollaSettingsEntity =>
  ({ id: 'settings-id', ...toCollaSettingsColumns({ ...DEFAULT_COLLA_SETTINGS, ...overrides }) }) as CollaSettingsEntity;

describe('CollaSettingsService', () => {
  let service: CollaSettingsService;
  let repo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let tagRepo: { existsBy: jest.Mock };
  let audit: { record: jest.Mock };
  const actor = { userId: 'admin-id', ipAddress: '10.0.0.1' };

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([storedRow()]),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'settings-id', ...data })),
    };
    tagRepo = { existsBy: jest.fn().mockResolvedValue(true) };
    audit = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaSettingsService,
        { provide: getRepositoryToken(CollaSettingsEntity), useValue: repo },
        { provide: getRepositoryToken(Tag), useValue: tagRepo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(CollaSettingsService);
  });

  afterEach(() => jest.useRealTimers());

  describe('get', () => {
    it('returns the stored settings', async () => {
      repo.find.mockResolvedValue([storedRow({ majorityAge: 18 })]);

      expect(await service.get()).toEqual({ ...DEFAULT_COLLA_SETTINGS, majorityAge: 18 });
    });

    it('reads the database once for repeated and concurrent calls', async () => {
      await Promise.all([service.get(), service.get()]);
      await service.get();

      expect(repo.find).toHaveBeenCalledTimes(1);
    });

    it('reads the database again once the cache is a minute old', async () => {
      jest.useFakeTimers();
      await service.get();

      jest.advanceTimersByTime(60_001);
      await service.get();

      expect(repo.find).toHaveBeenCalledTimes(2);
    });

    it('stores the defaults when the row is missing', async () => {
      repo.find.mockResolvedValue([]);

      expect(await service.get()).toEqual(DEFAULT_COLLA_SETTINGS);
      expect(repo.save).toHaveBeenCalledWith(toCollaSettingsColumns(DEFAULT_COLLA_SETTINGS));
    });

    it('reads the row another request inserted first when its own insert loses the race', async () => {
      repo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([storedRow({ collaName: 'Guanyadora' })]);
      repo.save.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      expect((await service.get()).collaName).toBe('Guanyadora');
    });
  });

  describe('getPublic', () => {
    it('exposes only the colla name', async () => {
      expect(await service.getPublic()).toEqual({ collaName: DEFAULT_COLLA_SETTINGS.collaName });
    });
  });

  describe('update', () => {
    it('saves the changed fields and returns the new settings', async () => {
      const result = await service.update({ majorityAge: 18, collaName: 'Muixeranga Nova' }, actor);

      expect(result).toEqual({ ...DEFAULT_COLLA_SETTINGS, majorityAge: 18, collaName: 'Muixeranga Nova' });
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'settings-id', majorityAge: 18 }));
    });

    it('serves the new settings without reading the database again', async () => {
      await service.get();
      await service.update({ shoulderHeightBaselineCm: 150 }, actor);

      expect((await service.get()).shoulderHeightBaselineCm).toBe(150);
      expect(repo.find).toHaveBeenCalledTimes(1);
    });

    it('replaces a nested group as a whole', async () => {
      const shirtRequirements = { performances: 1, rehearsals: 1 };

      expect((await service.update({ shirtRequirements }, actor)).shirtRequirements).toEqual(shirtRequirements);
    });

    it.each([
      ['floor', { floor: { warning: 10, error: 10 }, support: { warning: 3, error: 5 } }],
      ['support', { floor: { warning: 5, error: 10 }, support: { warning: 6, error: 5 } }],
    ])('rejects a %s warning that is not below its error', async (_label, troncHeightThresholds) => {
      await expect(service.update({ troncHeightThresholds }, actor)).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects a default tag that does not exist', async () => {
      tagRepo.existsBy.mockResolvedValue(false);

      await expect(service.update({ defaultTagId: 'missing-tag' }, actor)).rejects.toThrow(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('accepts no default tag without looking for one', async () => {
      repo.find.mockResolvedValue([storedRow({ defaultTagId: 'tag-id' })]);

      await service.update({ defaultTagId: null }, actor);

      expect(tagRepo.existsBy).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ defaultTagId: null }));
    });

    it('audits each changed field with its old and new value', async () => {
      await service.update({ majorityAge: 18, collaName: DEFAULT_COLLA_SETTINGS.collaName }, actor);

      expect(audit.record).toHaveBeenCalledWith({
        actorUserId: 'admin-id',
        ipAddress: '10.0.0.1',
        action: AuditAction.COLLA_SETTINGS_UPDATED,
        targetType: 'CollaSettings',
        targetId: 'settings-id',
        metadata: { changes: { majorityAge: { from: 16, to: 18 } } },
      });
    });

    it('neither saves nor audits when nothing changes', async () => {
      const result = await service.update({ majorityAge: DEFAULT_COLLA_SETTINGS.majorityAge }, actor);

      expect(result).toEqual(DEFAULT_COLLA_SETTINGS);
      expect(repo.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
