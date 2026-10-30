import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PushSubscriptionService } from './push-subscription.service';
import { PushSubscription } from './entities/push-subscription.entity';
import { User } from '../user/user.entity';
import { PushSenderService } from './push-sender.service';
import { RegisterSubscriptionDto } from './dto/register-subscription.dto';
import { ALLOWED_PUSH_DOMAINS } from './dto/register-subscription.dto';

const makeDto = (overrides: Partial<RegisterSubscriptionDto> = {}): RegisterSubscriptionDto => {
  const dto = new RegisterSubscriptionDto();
  dto.endpoint = `https://fcm.googleapis.com/push/${Date.now()}`;
  dto.keys = { p256dh: 'abc123', auth: 'secret' };
  dto.userAgent = 'Chrome/120';
  return Object.assign(dto, overrides);
};

const makeUser = (personId?: string) => ({
  id: 'user-1',
  person: personId ? { id: personId } : null,
}) as unknown as User;

describe('PushSubscriptionService', () => {
  let service: PushSubscriptionService;
  let repo: jest.Mocked<Repository<PushSubscription>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let sender: { send: jest.Mock };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PushSubscriptionService,
        { provide: PushSenderService, useValue: { send: jest.fn() } },
        {
          provide: getRepositoryToken(PushSubscription),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneOrFail: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PushSubscriptionService);
    repo = module.get(getRepositoryToken(PushSubscription));
    userRepo = module.get(getRepositoryToken(User));
    sender = module.get(PushSenderService);
  });

  describe('register', () => {
    it('throws ForbiddenException when user has no linked person', async () => {
      userRepo.findOne.mockResolvedValue(makeUser(undefined));
      await expect(service.register('user-1', makeDto())).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for disallowed endpoint domain', async () => {
      userRepo.findOne.mockResolvedValue(makeUser('person-1'));
      const dto = makeDto();
      dto.endpoint = 'https://evil.example.com/push/abc';
      await expect(service.register('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('upserts when same endpoint already exists for same user', async () => {
      userRepo.findOne.mockResolvedValue(makeUser('person-1'));
      const existingSub = { id: 'sub-1', userId: 'user-1', endpoint: 'https://fcm.googleapis.com/push/1', keys: {}, isActive: true } as PushSubscription;
      repo.findOne.mockResolvedValueOnce(existingSub);
      repo.update.mockResolvedValue({ affected: 1 } as never);
      repo.findOneOrFail.mockResolvedValue(existingSub);

      const dto = makeDto({ endpoint: 'https://fcm.googleapis.com/push/1' });
      const result = await service.register('user-1', dto);
      expect(repo.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ isActive: true }));
      expect(result).toEqual(existingSub);
    });

    it('enforces the device cap when re-enabling an inactive endpoint', async () => {
      userRepo.findOne.mockResolvedValue(makeUser('person-1'));
      const existingSub = { id: 'sub-1', userId: 'user-1', endpoint: 'https://fcm.googleapis.com/push/1', keys: {}, isActive: false } as PushSubscription;
      repo.findOne.mockResolvedValueOnce(existingSub);
      repo.count.mockResolvedValue(10);

      const dto = makeDto({ endpoint: 'https://fcm.googleapis.com/push/1' });
      await expect(service.register('user-1', dto)).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('skips the cap check when the endpoint is already active', async () => {
      userRepo.findOne.mockResolvedValue(makeUser('person-1'));
      const existingSub = { id: 'sub-1', userId: 'user-1', endpoint: 'https://fcm.googleapis.com/push/1', keys: {}, isActive: true } as PushSubscription;
      repo.findOne.mockResolvedValueOnce(existingSub);
      repo.update.mockResolvedValue({ affected: 1 } as never);
      repo.findOneOrFail.mockResolvedValue(existingSub);

      await service.register('user-1', makeDto({ endpoint: 'https://fcm.googleapis.com/push/1' }));
      expect(repo.count).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when another user owns the same endpoint', async () => {
      userRepo.findOne.mockResolvedValue(makeUser('person-1'));
      const existingSub = { id: 'sub-1', userId: 'other-user', endpoint: 'https://fcm.googleapis.com/push/1' } as PushSubscription;
      repo.findOne.mockResolvedValueOnce(existingSub);

      const dto = makeDto({ endpoint: 'https://fcm.googleapis.com/push/1' });
      await expect(service.register('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when user has 10 active subscriptions', async () => {
      userRepo.findOne.mockResolvedValue(makeUser('person-1'));
      repo.findOne.mockResolvedValueOnce(null);
      repo.count.mockResolvedValue(10);

      await expect(service.register('user-1', makeDto())).rejects.toThrow(BadRequestException);
    });

    it('creates a new subscription', async () => {
      userRepo.findOne.mockResolvedValue(makeUser('person-1'));
      repo.findOne.mockResolvedValueOnce(null);
      repo.count.mockResolvedValue(0);
      const newSub = { id: 'sub-new' } as PushSubscription;
      repo.create.mockReturnValue(newSub);
      repo.save.mockResolvedValue(newSub);

      const result = await service.register('user-1', makeDto());
      expect(repo.save).toHaveBeenCalled();
      expect(result).toEqual(newSub);
    });
  });

  describe('unsubscribe', () => {
    it('throws NotFoundException when subscription not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.unsubscribe('user-1', 'https://fcm.googleapis.com/push/x')).rejects.toThrow(NotFoundException);
    });

    it('soft-deletes by setting isActive = false', async () => {
      const sub = { id: 'sub-1', userId: 'user-1' } as PushSubscription;
      repo.findOne.mockResolvedValue(sub);
      repo.update.mockResolvedValue({ affected: 1 } as never);

      await service.unsubscribe('user-1', 'https://fcm.googleapis.com/push/1');
      expect(repo.update).toHaveBeenCalledWith('sub-1', { isActive: false });
    });
  });

  describe('getStatus', () => {
    it('returns isSubscribed false when device count is 0', async () => {
      repo.count.mockResolvedValue(0);
      const result = await service.getStatus('user-1');
      expect(result).toEqual({ isSubscribed: false, deviceCount: 0 });
    });

    it('returns isSubscribed true when device count > 0', async () => {
      repo.count.mockResolvedValue(2);
      const result = await service.getStatus('user-1');
      expect(result).toEqual({ isSubscribed: true, deviceCount: 2 });
    });
  });

  describe('deactivateMany', () => {
    it('sets isActive false on every given subscription with a single update', async () => {
      repo.update.mockResolvedValue({ affected: 3 } as never);

      await service.deactivateMany(['sub-1', 'sub-2', 'sub-3']);

      expect(repo.update).toHaveBeenCalledTimes(1);
      expect(repo.update).toHaveBeenCalledWith({ id: In(['sub-1', 'sub-2', 'sub-3']) }, { isActive: false });
    });

    it('does not touch the database for an empty list', async () => {
      await service.deactivateMany([]);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('markUsedMany', () => {
    it('stamps lastUsedAt on every given subscription with a single update', async () => {
      repo.update.mockResolvedValue({ affected: 2 } as never);

      await service.markUsedMany(['sub-1', 'sub-2']);

      expect(repo.update).toHaveBeenCalledTimes(1);
      expect(repo.update).toHaveBeenCalledWith({ id: In(['sub-1', 'sub-2']) }, { lastUsedAt: expect.any(Date) });
    });

    it('does not touch the database for an empty list', async () => {
      await service.markUsedMany([]);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('per-user device management', () => {
    it('listActiveForUser never exposes endpoint or keys', async () => {
      repo.find.mockResolvedValue([
        { id: 's1', userId: 'u1', endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' }, userAgent: 'UA', isActive: true,
          createdAt: new Date('2026-01-01T00:00:00Z'), lastUsedAt: null },
      ] as never);

      const res = await service.listActiveForUser('u1');

      expect(repo.find).toHaveBeenCalledWith({ where: { userId: 'u1', isActive: true }, order: { createdAt: 'DESC' } });
      expect(res).toEqual([{ id: 's1', userAgent: 'UA', createdAt: '2026-01-01T00:00:00.000Z', lastUsedAt: null }]);
      expect(JSON.stringify(res)).not.toContain('endpoint');
      expect(JSON.stringify(res)).not.toContain('keys');
    });

    it('deactivateForUser returns false and updates nothing for another user\'s id', async () => {
      repo.update.mockResolvedValue({ affected: 0 } as never);

      await expect(service.deactivateForUser('u1', 'foreign')).resolves.toBe(false);
      expect(repo.update).toHaveBeenCalledWith({ id: 'foreign', userId: 'u1', isActive: true }, { isActive: false });
    });

    it('deactivateForUser returns true when a row was deactivated', async () => {
      repo.update.mockResolvedValue({ affected: 1 } as never);
      await expect(service.deactivateForUser('u1', 's1')).resolves.toBe(true);
    });

    it('sendTest returns null when the subscription is not the user\'s or is inactive', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.sendTest('u1', 'foreign')).resolves.toBeNull();
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'foreign', userId: 'u1', isActive: true } });
      expect(sender.send).not.toHaveBeenCalled();
    });

    it('sendTest marks the subscription used on success', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', userId: 'u1', endpoint: 'e', keys: {} } as never);
      repo.update.mockResolvedValue({ affected: 1 } as never);
      sender.send.mockResolvedValue({ success: true });

      await expect(service.sendTest('u1', 's1')).resolves.toEqual({ success: true, gone: false });
      expect(sender.send).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's1' }),
        expect.objectContaining({ title: 'Notificació de prova' }),
      );
      expect(repo.update).toHaveBeenCalledWith({ id: In(['s1']) }, { lastUsedAt: expect.any(Date) });
    });

    it('sendTest deactivates the subscription when the push service answers gone', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', userId: 'u1', endpoint: 'e', keys: {} } as never);
      repo.update.mockResolvedValue({ affected: 1 } as never);
      sender.send.mockResolvedValue({ success: false, gone: true });

      await expect(service.sendTest('u1', 's1')).resolves.toEqual({ success: false, gone: true });
      expect(repo.update).toHaveBeenCalledWith({ id: In(['s1']) }, { isActive: false });
    });
  });
});
