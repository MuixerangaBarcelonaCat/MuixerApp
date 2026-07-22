import { Test, TestingModule } from '@nestjs/testing';
import { DelegateType } from '@muixer/shared';
import { PersonDelegateController } from './person-delegate.controller';
import { PersonDelegateService } from './person-delegate.service';

describe('PersonDelegateController', () => {
  let controller: PersonDelegateController;

  const mockService = {
    findByPerson: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonDelegateController],
      providers: [
        { provide: PersonDelegateService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<PersonDelegateController>(
      PersonDelegateController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return serialized delegates for a person', async () => {
      const personId = 'person-1';
      const delegates = [
        {
          id: 'del-1',
          delegateType: DelegateType.PARENT,
          isActive: true,
          createdAt: new Date('2026-07-01'),
          user: { id: 'user-1', email: 'parent@test.com', passwordHash: 'SHOULD_NOT_APPEAR' },
          person: { id: personId, alias: 'child' },
        },
      ];
      mockService.findByPerson.mockResolvedValue(delegates);

      const result = await controller.findAll(personId);

      expect(mockService.findByPerson).toHaveBeenCalledWith(personId);
      expect(result[0]).toHaveProperty('id', 'del-1');
      expect(result[0]).toHaveProperty('user');
      expect(result[0].user).toHaveProperty('email', 'parent@test.com');
      expect((result[0].user as unknown as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create and return serialized delegate', async () => {
      const personId = 'person-1';
      const dto = { userId: 'user-1', delegateType: DelegateType.PARENT };
      const created = {
        id: 'del-1',
        delegateType: DelegateType.PARENT,
        isActive: true,
        createdAt: new Date(),
        user: { id: 'user-1', email: 'parent@test.com', passwordHash: 'secret' },
        person: { id: personId, alias: 'child' },
      };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(personId, dto);

      expect(mockService.create).toHaveBeenCalledWith(personId, dto);
      expect(result).toHaveProperty('id', 'del-1');
      expect((result.user as unknown as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update and return serialized delegate', async () => {
      const dto = { delegateType: DelegateType.GUARDIAN };
      const updated = {
        id: 'del-1',
        delegateType: DelegateType.GUARDIAN,
        isActive: true,
        createdAt: new Date(),
        user: { id: 'user-1', email: 'u@t.com' },
        person: { id: 'p1', alias: 'x' },
      };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('p1', 'del-1', dto);

      expect(result.delegateType).toBe(DelegateType.GUARDIAN);
      expect(mockService.update).toHaveBeenCalledWith('p1', 'del-1', dto);
    });
  });

  describe('remove', () => {
    it('should remove a delegate', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('p1', 'del-1');

      expect(mockService.remove).toHaveBeenCalledWith('p1', 'del-1');
    });
  });
});
