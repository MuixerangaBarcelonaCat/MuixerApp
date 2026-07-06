import { Test, TestingModule } from '@nestjs/testing';
import { PATH_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@muixer/shared';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const mockUserService = () => ({
  createUser: jest.fn(),
  createWithInvite: jest.fn(),
  findAll: jest.fn(),
  grantRole: jest.fn(),
  deactivateUser: jest.fn(),
  updateUser: jest.fn(),
});

describe('UserController', () => {
  let controller: UserController;
  let service: ReturnType<typeof mockUserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useFactory: mockUserService }],
    }).compile();

    controller = module.get(UserController);
    service = module.get(UserService);
  });

  it('createUser delegates to UserService with the actor role', async () => {
    service.createUser.mockResolvedValue({ id: 'user-1' });
    const dto = { email: 'a@b.cat', password: 'pw', role: UserRole.TECHNICAL };

    const result = await controller.createUser(dto as never, { sub: 'actor-1', role: UserRole.ADMIN } as never);

    expect(service.createUser).toHaveBeenCalledWith(dto, UserRole.ADMIN);
    expect(result).toEqual({ id: 'user-1' });
  });

  it('createWithInvite delegates to UserService', async () => {
    service.createWithInvite.mockResolvedValue({ id: 'user-2' });
    const dto = { personId: 'person-1', email: 'a@b.cat' };

    const result = await controller.createWithInvite(dto as never);

    expect(service.createWithInvite).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'user-2' });
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
});
