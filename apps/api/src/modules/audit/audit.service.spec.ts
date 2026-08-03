import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditAction } from '@muixer/shared';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';

const mockRepo = () => ({
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn(),
});

describe('AuditService', () => {
  let service: AuditService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: getRepositoryToken(AuditLog), useFactory: mockRepo }],
    }).compile();

    service = module.get(AuditService);
    repo = module.get(getRepositoryToken(AuditLog));
  });

  it('persists a normalized audit entry', async () => {
    repo.save.mockResolvedValue({});

    await service.record({
      actorUserId: 'user-1',
      action: AuditAction.SENSITIVE_DATA_ACCESS,
      targetType: 'Person',
      targetId: 'person-1',
      ipAddress: '10.0.0.1',
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        action: AuditAction.SENSITIVE_DATA_ACCESS,
        targetType: 'Person',
        targetId: 'person-1',
        metadata: null,
        ipAddress: '10.0.0.1',
      }),
    );
  });

  it('defaults optional fields to null', async () => {
    repo.save.mockResolvedValue({});

    await service.record({ action: AuditAction.CONSENT_ACCEPTED });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
        targetType: null,
        targetId: null,
        metadata: null,
        ipAddress: null,
      }),
    );
  });

  it('never throws when the write fails — audit logging must not break the primary operation', async () => {
    repo.save.mockRejectedValue(new Error('db down'));

    await expect(service.record({ action: AuditAction.CONSENT_ACCEPTED })).resolves.toBeUndefined();
  });
});
