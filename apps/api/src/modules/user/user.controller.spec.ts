import { Test, TestingModule } from '@nestjs/testing';
import { PATH_METADATA } from '@nestjs/common/constants';
import { AuditAction, JwtPayload, UserRole } from '@muixer/shared';
import { Request } from 'express';
import { ROLES_KEY } from '../auth/constants/auth.constants';
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
  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const adminUser = {
    sub: 'admin-1',
    role: UserRole.ADMIN,
  } as JwtPayload;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useFactory: mockUserService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    controller = module.get(UserController);
    service = module.get(UserService);
    jest.clearAllMocks();
  });

  it('restricts user management to ADMIN', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, UserController);

    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('keeps invite-link creation available to TECHNICAL and ADMIN', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      UserController.prototype.createInviteLink,
    );

    expect(roles).toEqual([UserRole.TECHNICAL, UserRole.ADMIN]);
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

  it('records one aggregate user-list access with safe metadata after success', async () => {
    service.findAll.mockResolvedValue({
      data: [{ id: 'user-1', email: 'private@example.com' }],
      total: 9,
    });
    const filters = { page: 2, limit: 20, search: 'private search' };

    const result = await (
      controller.findAll as unknown as (
        filters: never,
        user: JwtPayload,
        request: Request,
      ) => ReturnType<UserController['findAll']>
    )(filters as never, adminUser, { ip: '10.0.0.5' } as Request);

    expect(service.findAll).toHaveBeenCalledWith(filters);
    expect(result).toEqual({
      data: [{ id: 'user-1', email: 'private@example.com' }],
      total: 9,
    });
    expect(auditService.record).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: AuditAction.SENSITIVE_DATA_ACCESS,
      targetType: 'User',
      metadata: {
        role: UserRole.ADMIN,
        route: '/users',
        page: 2,
        resultCount: 1,
      },
      ipAddress: '10.0.0.5',
    });
  });

  it('does not record user-list access when the read fails', async () => {
    service.findAll.mockRejectedValue(new Error('read failed'));

    await expect(
      (
        controller.findAll as unknown as (
          filters: never,
          user: JwtPayload,
          request: Request,
        ) => ReturnType<UserController['findAll']>
      )(
        { page: 1 } as never,
        adminUser,
        { ip: '10.0.0.5' } as Request,
      ),
    ).rejects.toThrow('read failed');

    expect(auditService.record).not.toHaveBeenCalled();
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
});
