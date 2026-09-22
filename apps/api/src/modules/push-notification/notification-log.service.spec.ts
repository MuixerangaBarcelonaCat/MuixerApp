import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationSource, NotificationTargetType } from '@muixer/shared';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationLogService } from './notification-log.service';

const mockRepo = () => ({
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn(),
  findAndCount: jest.fn(),
});

describe('NotificationLogService', () => {
  let service: NotificationLogService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationLogService,
        { provide: getRepositoryToken(NotificationLog), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(NotificationLogService);
    repo = module.get(getRepositoryToken(NotificationLog));
  });

  describe('record', () => {
    it('persists a normalized log entry', async () => {
      repo.save.mockResolvedValue({});

      await service.record({
        title: 'Assaig',
        body: 'Dijous a les 20h',
        url: '/events/1',
        target: { type: NotificationTargetType.ALL },
        recipientCount: 12,
        source: NotificationSource.MANUAL,
        triggeredByUserId: 'user-1',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Assaig',
          body: 'Dijous a les 20h',
          url: '/events/1',
          target: { type: NotificationTargetType.ALL },
          recipientCount: 12,
          source: NotificationSource.MANUAL,
          scheduleId: null,
          triggeredEventId: null,
          triggeredByUserId: 'user-1',
        }),
      );
    });

    it('defaults optional fields to null', async () => {
      repo.save.mockResolvedValue({});

      await service.record({
        title: 'Actuació',
        body: 'Dissabte a les 18h',
        target: { type: NotificationTargetType.ALL },
        recipientCount: 0,
        source: NotificationSource.MANUAL,
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          url: null,
          scheduleId: null,
          triggeredEventId: null,
          triggeredByUserId: null,
        }),
      );
    });

    it('never throws when the write fails — logging must not break the actual send', async () => {
      repo.save.mockRejectedValue(new Error('db down'));

      await expect(
        service.record({
          title: 'Assaig',
          body: 'Dijous a les 20h',
          target: { type: NotificationTargetType.ALL },
          recipientCount: 0,
          source: NotificationSource.MANUAL,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('returns a paginated response', async () => {
      const rows = [{ id: 'log-1' } as NotificationLog];
      repo.findAndCount.mockResolvedValue([rows, 1]);

      const result = await service.findAll({ page: 1, limit: 25 });

      expect(result).toEqual({ data: rows, meta: { total: 1, page: 1, limit: 25 } });
    });

    it('defaults page/limit and orders by sentAt descending', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { sentAt: 'DESC' },
          skip: 0,
          take: 25,
        }),
      );
    });

    it('filters by source when provided', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ source: NotificationSource.SCHEDULED_ONE_OFF });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { source: NotificationSource.SCHEDULED_ONE_OFF } }),
      );
    });
  });
});
