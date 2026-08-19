import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscriptionService } from './push-subscription.service';
import { PushSubscription } from './entities/push-subscription.entity';
import { User } from '../user/user.entity';
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

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PushSubscriptionService,
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

  describe('deactivate', () => {
    it('sets isActive false on the given subscription', async () => {
      repo.update.mockResolvedValue({ affected: 1 } as never);
      await service.deactivate('sub-1');
      expect(repo.update).toHaveBeenCalledWith('sub-1', { isActive: false });
    });
  });
});
