import { Test, TestingModule } from '@nestjs/testing';
import { PATH_METADATA } from '@nestjs/common/constants';
import { NotFoundException } from '@nestjs/common';
import { AuditAction, UserRole } from '@muixer/shared';
import { PushSubscriptionService } from '../push-notification/push-subscription.service';
import { TokenService } from '../auth/token.service';
import { AuditService } from '../audit/audit.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const mockUserService = () => ({
  createUser: jest.fn(),
  createOrRefreshInviteLink: jest.fn(),
  findAll: jest.fn(),
  grantRole: jest.fn(),
  deactivateUser: jest.fn(),
  updateUser: jest.fn(),
});

describe('UserController', () => {
  let controller: UserController;
  let service: ReturnType<typeof mockUserService>;
  let tokenService: { listActiveSessions: jest.Mock; revokeFamily: jest.Mock; revokeAllUserTokens: jest.Mock };
  let audit: { record: jest.Mock };
  let push: { listActiveForUser: jest.Mock; deactivateForUser: jest.Mock; sendTest: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useFactory: mockUserService },
        {
          provide: TokenService,
          useValue: { listActiveSessions: jest.fn(), revokeFamily: jest.fn(), revokeAllUserTokens: jest.fn() },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        {
          provide: PushSubscriptionService,
          useValue: { listActiveForUser: jest.fn(), deactivateForUser: jest.fn(), sendTest: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(UserController);
    service = module.get(UserService);
    tokenService = module.get(TokenService);
    audit = module.get(AuditService);
    push = module.get(PushSubscriptionService);
  });

  it('createUser delegates to UserService with the actor role', async () => {
    service.createUser.mockResolvedValue({ id: 'user-1' });
    const dto = { email: 'a@b.cat', password: 'pw', role: UserRole.TECHNICAL };

    const result = await controller.createUser(dto as never, { sub: 'actor-1', role: UserRole.ADMIN } as never);

    expect(service.createUser).toHaveBeenCalledWith(dto, UserRole.ADMIN);
    expect(result).toEqual({ id: 'user-1' });
  });

  it('createInviteLink delegates to UserService with the personId', async () => {
    const inviteResponse = { inviteUrl: 'https://app.example.com/activate?token=abc', expiresAt: '2026-01-01T00:00:00.000Z' };
    service.createOrRefreshInviteLink.mockResolvedValue(inviteResponse);
    const dto = { personId: 'person-1' };

    const result = await controller.createInviteLink(dto as never);

    expect(service.createOrRefreshInviteLink).toHaveBeenCalledWith('person-1');
    expect(result).toEqual(inviteResponse);
  });

  it('findAll delegates to UserService with the filters', async () => {
    service.findAll.mockResolvedValue({ data: [], total: 0 });
    const filters = { page: 1, limit: 20 };

    const result = await controller.findAll(filters as never);

    expect(service.findAll).toHaveBeenCalledWith(filters);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('grantRole route declares the :id path param so the handler can receive it', () => {
    const path = Reflect.getMetadata(PATH_METADATA, UserController.prototype.grantRole);

    expect(path).toBe(':id/grant-role');
  });

  it('grantRole delegates to UserService with the id, role and actor id', async () => {
    service.grantRole.mockResolvedValue({ id: 'user-1', role: UserRole.ADMIN });

    const result = await controller.grantRole(
      'user-1',
      { role: UserRole.ADMIN },
      { sub: 'actor-1', role: UserRole.ADMIN } as never,
    );

    expect(service.grantRole).toHaveBeenCalledWith('user-1', UserRole.ADMIN, 'actor-1');
    expect(result).toEqual({ id: 'user-1', role: UserRole.ADMIN });
  });

  it('deactivateUser delegates to UserService with the id, actor role and actor id', async () => {
    service.deactivateUser.mockResolvedValue(undefined);

    await controller.deactivateUser('user-1', { sub: 'actor-1', role: UserRole.ADMIN } as never);

    expect(service.deactivateUser).toHaveBeenCalledWith('user-1', UserRole.ADMIN, 'actor-1');
  });

  it('updateUser delegates to UserService with the id, dto, actor role and actor id', async () => {
    service.updateUser.mockResolvedValue({ id: 'user-1', email: 'new@b.cat' });
    const dto = { email: 'new@b.cat' };

    const result = await controller.updateUser('user-1', dto as never, {
      sub: 'actor-1',
      role: UserRole.ADMIN,
    } as never);

    expect(service.updateUser).toHaveBeenCalledWith('user-1', dto, UserRole.ADMIN, 'actor-1');
    expect(result).toEqual({ id: 'user-1', email: 'new@b.cat' });
  });

  describe('sessions', () => {
    const actor = { sub: 'admin-1', role: UserRole.ADMIN } as never;

    it('lists the active sessions of the user', async () => {
      tokenService.listActiveSessions.mockResolvedValue([{ family: 'f1' }]);
      await expect(controller.listSessions('u1')).resolves.toEqual([{ family: 'f1' }]);
      expect(tokenService.listActiveSessions).toHaveBeenCalledWith('u1');
    });

    it('revokes one session scoped to the user and audits it', async () => {
      tokenService.revokeFamily.mockResolvedValue(1);
      await controller.revokeSession('u1', 'f1', actor);
      expect(tokenService.revokeFamily).toHaveBeenCalledWith('u1', 'f1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          action: AuditAction.USER_SESSIONS_REVOKED,
          targetType: 'User',
          targetId: 'u1',
          metadata: { family: 'f1' },
        }),
      );
    });

    it('404s and audits nothing when the family is not the user\'s', async () => {
      tokenService.revokeFamily.mockResolvedValue(0);
      await expect(controller.revokeSession('u1', 'other', actor)).rejects.toThrow(NotFoundException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('revokes all sessions and audits it', async () => {
      await controller.revokeAllSessions('u1', actor);
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith('u1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.USER_SESSIONS_REVOKED, targetId: 'u1', metadata: { family: 'all' } }),
      );
    });

    it('restricts the three routes to ADMIN', () => {
      for (const m of ['listSessions', 'revokeSession', 'revokeAllSessions'] as const) {
        expect(Reflect.getMetadata('roles', UserController.prototype[m])).toEqual([UserRole.ADMIN]);
      }
    });
  });

  describe('push subscriptions', () => {
    const actor = { sub: 'admin-1', role: UserRole.ADMIN } as never;

    it('lists the devices of the user', async () => {
      push.listActiveForUser.mockResolvedValue([{ id: 's1' }]);
      await expect(controller.listPushDevices('u1')).resolves.toEqual([{ id: 's1' }]);
      expect(push.listActiveForUser).toHaveBeenCalledWith('u1');
    });

    it('removes a subscription of the user and audits it', async () => {
      push.deactivateForUser.mockResolvedValue(true);
      await controller.removePushDevice('u1', 's1', actor);
      expect(push.deactivateForUser).toHaveBeenCalledWith('u1', 's1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          action: AuditAction.PUSH_SUBSCRIPTION_REMOVED,
          targetType: 'User',
          targetId: 'u1',
          metadata: { subscriptionId: 's1' },
        }),
      );
    });

    it('404s when removing a subscription that is not the user\'s', async () => {
      push.deactivateForUser.mockResolvedValue(false);
      await expect(controller.removePushDevice('u1', 'foreign', actor)).rejects.toThrow(NotFoundException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('sends a test and returns the result; 404 when not the user\'s', async () => {
      push.sendTest.mockResolvedValueOnce({ success: false, gone: true });
      await expect(controller.testPushDevice('u1', 's1')).resolves.toEqual({ success: false, gone: true });
      push.sendTest.mockResolvedValueOnce(null);
      await expect(controller.testPushDevice('u1', 'foreign')).rejects.toThrow(NotFoundException);
    });

    it('restricts the routes to ADMIN', () => {
      for (const m of ['listPushDevices', 'removePushDevice', 'testPushDevice'] as const) {
        expect(Reflect.getMetadata('roles', UserController.prototype[m])).toEqual([UserRole.ADMIN]);
      }
    });
  });
});
