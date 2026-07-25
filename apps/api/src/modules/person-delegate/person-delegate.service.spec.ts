import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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

describe('PersonDelegateService', () => {
  let service: PersonDelegateService;

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
