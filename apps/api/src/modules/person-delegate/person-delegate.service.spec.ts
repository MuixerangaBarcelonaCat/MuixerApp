import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DelegateType } from '@muixer/shared';
import { PersonDelegateService } from './person-delegate.service';
import { PersonDelegate } from './person-delegate.entity';
import { Person } from '../person/person.entity';
import { User } from '../user/user.entity';

// The transaction manager exposes a scoped repository used by create()/update()
// when swapping the primary delegate.
const makeTxRepo = () => ({
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve({ id: 'del-new', ...data })),
});

describe('PersonDelegateService', () => {
  let service: PersonDelegateService;
  let txRepo: ReturnType<typeof makeTxRepo>;
  let dataSource: { transaction: jest.Mock };

  const mockDelegateRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockPersonRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    txRepo = makeTxRepo();
    dataSource = {
      transaction: jest.fn((cb: (m: unknown) => unknown) =>
        cb({ getRepository: () => txRepo }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonDelegateService,
        {
          provide: getRepositoryToken(PersonDelegate),
          useValue: mockDelegateRepository,
        },
        {
          provide: getRepositoryToken(Person),
          useValue: mockPersonRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<PersonDelegateService>(PersonDelegateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByPerson', () => {
    it('should return delegates for a person', async () => {
      const personId = 'person-1';
      const delegates = [
        {
          id: 'del-1',
          delegateType: DelegateType.PARENT,
          isActive: true,
          user: { id: 'user-1', email: 'parent@test.com' },
          person: { id: personId, alias: 'child' },
        },
      ];
      mockDelegateRepository.find.mockResolvedValue(delegates);

      const result = await service.findByPerson(personId);

      expect(result).toEqual(delegates);
      expect(mockDelegateRepository.find).toHaveBeenCalledWith({
        where: { person: { id: personId } },
        relations: ['user', 'person'],
        order: { createdAt: 'ASC' },
      });
    });

    it('should return empty array when no delegates', async () => {
      mockDelegateRepository.find.mockResolvedValue([]);

      const result = await service.findByPerson('person-no-delegates');

      expect(result).toEqual([]);
    });
  });

  describe('findByUser', () => {
    it('should return persons delegated to a user', async () => {
      const userId = 'user-1';
      const delegates = [
        {
          id: 'del-1',
          delegateType: DelegateType.PARENT,
          isActive: true,
          user: { id: userId, email: 'parent@test.com' },
          person: { id: 'person-1', alias: 'child' },
        },
      ];
      mockDelegateRepository.find.mockResolvedValue(delegates);

      const result = await service.findByUser(userId);

      expect(result).toEqual(delegates);
      expect(mockDelegateRepository.find).toHaveBeenCalledWith({
        where: { user: { id: userId }, isActive: true },
        relations: ['user', 'person'],
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('create', () => {
    const personId = 'person-1';
    const dto = { userId: 'user-1', delegateType: DelegateType.PARENT };

    it('should create a delegate when person and user exist', async () => {
      const person = { id: personId, alias: 'child' };
      const user = { id: 'user-1', email: 'parent@test.com', person: { id: 'person-parent' } };
      const created = {
        id: 'del-1',
        person,
        user,
        delegateType: DelegateType.PARENT,
        isActive: true,
      };

      mockPersonRepository.findOne.mockResolvedValue(person);
      mockUserRepository.findOne.mockResolvedValue(user);
      mockDelegateRepository.findOne.mockResolvedValue(null);
      mockDelegateRepository.create.mockReturnValue(created);
      mockDelegateRepository.save.mockResolvedValue(created);

      const result = await service.create(personId, dto);

      expect(result).toEqual(created);
      expect(mockDelegateRepository.create).toHaveBeenCalledWith({
        person,
        user,
        delegateType: DelegateType.PARENT,
        isPrimary: false,
      });
    });

    it('should throw NotFoundException when person does not exist', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      await expect(service.create(personId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPersonRepository.findOne.mockResolvedValue({ id: personId });
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.create(personId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when delegate already exists', async () => {
      mockPersonRepository.findOne.mockResolvedValue({ id: personId });
      mockUserRepository.findOne.mockResolvedValue({ id: 'user-1' });
      mockDelegateRepository.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.create(personId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException on self-delegation', async () => {
      const selfUserId = 'user-self';
      const selfDto = { userId: selfUserId, delegateType: DelegateType.PARTNER };
      const person = { id: personId };
      const user = { id: selfUserId, person: { id: personId } };

      mockPersonRepository.findOne.mockResolvedValue(person);
      mockUserRepository.findOne.mockResolvedValue(user);

      await expect(service.create(personId, selfDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should demote the existing primary and create the new one as primary, in a transaction', async () => {
      const person = { id: personId };
      const user = { id: 'user-1', email: 'parent@test.com', person: null };
      const primaryDto = { ...dto, isPrimary: true };

      mockPersonRepository.findOne.mockResolvedValue(person);
      mockUserRepository.findOne.mockResolvedValue(user);
      mockDelegateRepository.findOne.mockResolvedValue(null);

      const result = await service.create(personId, primaryDto);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(txRepo.update).toHaveBeenCalledWith(
        { person: { id: personId } },
        { isPrimary: false },
      );
      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ person, user, isPrimary: true }),
      );
      expect(result).toEqual(expect.objectContaining({ isPrimary: true }));
    });

    it('should not demote any primary or use a transaction when isPrimary is not set', async () => {
      const person = { id: personId };
      const user = { id: 'user-1', email: 'parent@test.com', person: null };
      const created = { id: 'del-1', person, user, delegateType: DelegateType.PARENT, isPrimary: false };

      mockPersonRepository.findOne.mockResolvedValue(person);
      mockUserRepository.findOne.mockResolvedValue(user);
      mockDelegateRepository.findOne.mockResolvedValue(null);
      mockDelegateRepository.create.mockReturnValue(created);
      mockDelegateRepository.save.mockResolvedValue(created);

      await service.create(personId, dto);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update delegate type', async () => {
      const existing = {
        id: 'del-1',
        delegateType: DelegateType.PARENT,
        isActive: true,
      };
      const updated = { ...existing, delegateType: DelegateType.GUARDIAN };

      mockDelegateRepository.findOne.mockResolvedValue(existing);
      mockDelegateRepository.save.mockResolvedValue(updated);

      const result = await service.update('person-1', 'del-1', {
        delegateType: DelegateType.GUARDIAN,
      });

      expect(result.delegateType).toBe(DelegateType.GUARDIAN);
      expect(mockDelegateRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'del-1', person: { id: 'person-1' } },
        }),
      );
    });

    it('should update isActive flag', async () => {
      const existing = {
        id: 'del-1',
        delegateType: DelegateType.PARENT,
        isActive: true,
      };
      const updated = { ...existing, isActive: false };

      mockDelegateRepository.findOne.mockResolvedValue(existing);
      mockDelegateRepository.save.mockResolvedValue(updated);

      const result = await service.update('person-1', 'del-1', { isActive: false });

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when the delegate does not belong to the person', async () => {
      mockDelegateRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('other-person', 'del-1', {
          delegateType: DelegateType.GUARDIAN,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should demote the existing primary and promote this delegate, in a transaction', async () => {
      const existing = {
        id: 'del-1',
        delegateType: DelegateType.PARENT,
        isActive: true,
        isPrimary: false,
      };
      mockDelegateRepository.findOne.mockResolvedValue(existing);
      (txRepo.save as jest.Mock).mockImplementation(
        (data: Record<string, unknown>) => Promise.resolve(data),
      );

      const result = await service.update('person-1', 'del-1', {
        isPrimary: true,
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(txRepo.update).toHaveBeenCalledWith(
        { person: { id: 'person-1' } },
        { isPrimary: false },
      );
      expect(result.isPrimary).toBe(true);
    });

    it('should not use a transaction when isPrimary is not part of the update', async () => {
      const existing = {
        id: 'del-1',
        delegateType: DelegateType.PARENT,
        isActive: true,
        isPrimary: false,
      };
      mockDelegateRepository.findOne.mockResolvedValue(existing);
      mockDelegateRepository.save.mockResolvedValue(existing);

      await service.update('person-1', 'del-1', { isActive: false });

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('getPrimary', () => {
    it('should return the primary delegate for a person', async () => {
      const primary = {
        id: 'del-1',
        isPrimary: true,
        user: { id: 'user-1', email: 'parent@test.com' },
        person: { id: 'person-1', alias: 'child' },
      };
      mockDelegateRepository.findOne.mockResolvedValue(primary);

      const result = await service.getPrimary('person-1');

      expect(result).toEqual(primary);
      expect(mockDelegateRepository.findOne).toHaveBeenCalledWith({
        where: { person: { id: 'person-1' }, isPrimary: true },
        relations: ['user', 'person'],
      });
    });

    it('should return null when the person has no primary delegate', async () => {
      mockDelegateRepository.findOne.mockResolvedValue(null);

      const result = await service.getPrimary('person-1');

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove a delegate', async () => {
      const existing = { id: 'del-1' };
      mockDelegateRepository.findOne.mockResolvedValue(existing);
      mockDelegateRepository.remove.mockResolvedValue(existing);

      await service.remove('person-1', 'del-1');

      expect(mockDelegateRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'del-1', person: { id: 'person-1' } },
        }),
      );
      expect(mockDelegateRepository.remove).toHaveBeenCalledWith(existing);
    });

    it('should throw NotFoundException when the delegate does not belong to the person', async () => {
      mockDelegateRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('other-person', 'del-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
