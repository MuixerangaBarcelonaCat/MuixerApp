import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
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
    update: jest.fn().mockResolvedValue({ affected: 1 }),
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
        relations: ['user', 'user.person', 'person'],
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

    it('restricts to active primary delegates on non-provisional persons when primaryOnly is true', async () => {
      const userId = 'user-1';
      mockDelegateRepository.find.mockResolvedValue([]);

      await service.findByUser(userId, { primaryOnly: true });

      expect(mockDelegateRepository.find).toHaveBeenCalledWith({
        where: {
          user: { id: userId },
          isActive: true,
          isPrimary: true,
          person: { isProvisional: false },
        },
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

    it('creates a delegate even when the linked user account is still inactive (pending activation)', async () => {
      const person = { id: personId, alias: 'child' };
      const inactiveUser = { id: 'user-1', email: null, isActive: false, person: null };
      const created = {
        id: 'del-1',
        person,
        user: inactiveUser,
        delegateType: DelegateType.PARENT,
        isActive: true,
      };

      mockPersonRepository.findOne.mockResolvedValue(person);
      mockUserRepository.findOne.mockResolvedValue(inactiveUser);
      mockDelegateRepository.findOne.mockResolvedValue(null);
      mockDelegateRepository.create.mockReturnValue(created);
      mockDelegateRepository.save.mockResolvedValue(created);

      await expect(service.create(personId, dto)).resolves.toEqual(created);
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

    it('should throw BadRequestException when isPrimary is requested for a person who already manages their own account', async () => {
      const person = { id: personId, user: { id: 'self-user' } };
      const user = { id: 'user-1', email: 'parent@test.com', person: null };
      const primaryDto = { ...dto, isPrimary: true };

      mockPersonRepository.findOne.mockResolvedValue(person);
      mockUserRepository.findOne.mockResolvedValue(user);
      mockDelegateRepository.findOne.mockResolvedValue(null);

      await expect(service.create(personId, primaryDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('Xicalla integrity rule', () => {
    const personId = 'child-1';
    const userId = 'user-1';
    const xicallaPerson = { id: personId, isXicalla: true, user: null };

    // Disambiguates the two different findOne() calls create() makes against
    // the delegate repo: the (user, person) duplicate check and the "does
    // this user manage another non-Xicalla person" qualification check.
    const createFindOneImpl = (otherNonXicallaDelegate: unknown) =>
      (options: { where: { person?: { id?: string; isXicalla?: boolean } } }) => {
        if (options.where.person?.isXicalla === false) {
          return Promise.resolve(otherNonXicallaDelegate);
        }
        return Promise.resolve(null); // no (user, person) duplicate
      };

    // update() additionally has a findOne() to load the delegate itself
    // (keyed by `id`), distinguished the same way.
    const updateFindOneImpl = (delegate: unknown, otherNonXicallaDelegate: unknown) =>
      (options: { where: { id?: string; person?: { isXicalla?: boolean } } }) => {
        if (options.where.id) return Promise.resolve(delegate);
        if (options.where.person?.isXicalla === false) {
          return Promise.resolve(otherNonXicallaDelegate);
        }
        return Promise.resolve(null);
      };

    describe('create', () => {
      const baseDto = { userId, delegateType: DelegateType.PARENT, isPrimary: true };

      it('rejects a PARTNER primary delegate for a Xicalla person', async () => {
        mockPersonRepository.findOne.mockResolvedValue(xicallaPerson);
        mockUserRepository.findOne.mockResolvedValue({ id: userId, person: null });
        mockDelegateRepository.findOne.mockImplementation(createFindOneImpl(null));

        await expect(
          service.create(personId, { ...baseDto, delegateType: DelegateType.PARTNER }),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects an OTHER primary delegate for a Xicalla person', async () => {
        mockPersonRepository.findOne.mockResolvedValue(xicallaPerson);
        mockUserRepository.findOne.mockResolvedValue({ id: userId, person: null });
        mockDelegateRepository.findOne.mockImplementation(createFindOneImpl(null));

        await expect(
          service.create(personId, { ...baseDto, delegateType: DelegateType.OTHER }),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects a PARENT/GUARDIAN primary delegate when the manager has no qualifying non-Xicalla person', async () => {
        mockPersonRepository.findOne.mockResolvedValue(xicallaPerson);
        mockUserRepository.findOne.mockResolvedValue({ id: userId, person: null });
        mockDelegateRepository.findOne.mockImplementation(createFindOneImpl(null));

        await expect(service.create(personId, baseDto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('allows a PARENT primary delegate when the manager is self-managed', async () => {
        mockPersonRepository.findOne.mockResolvedValue(xicallaPerson);
        mockUserRepository.findOne.mockResolvedValue({ id: userId, person: { id: 'parent-person' } });
        mockDelegateRepository.findOne.mockImplementation(createFindOneImpl(null));
        dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
          cb({ getRepository: () => txRepo }),
        );

        await expect(service.create(personId, baseDto)).resolves.toBeDefined();
      });

      it('allows a GUARDIAN primary delegate when the manager already manages another non-Xicalla person', async () => {
        mockPersonRepository.findOne.mockResolvedValue(xicallaPerson);
        mockUserRepository.findOne.mockResolvedValue({ id: userId, person: null });
        mockDelegateRepository.findOne.mockImplementation(createFindOneImpl({ id: 'existing-del' }));
        dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
          cb({ getRepository: () => txRepo }),
        );

        await expect(
          service.create(personId, { ...baseDto, delegateType: DelegateType.GUARDIAN }),
        ).resolves.toBeDefined();
      });

      it('does not apply the rule to a non-primary delegate for a Xicalla person', async () => {
        const created = { id: 'del-1', person: xicallaPerson, delegateType: DelegateType.PARTNER, isPrimary: false };
        mockPersonRepository.findOne.mockResolvedValue(xicallaPerson);
        mockUserRepository.findOne.mockResolvedValue({ id: userId, person: null });
        mockDelegateRepository.findOne.mockImplementation(createFindOneImpl(null));
        mockDelegateRepository.create.mockReturnValue(created);
        mockDelegateRepository.save.mockResolvedValue(created);

        await expect(
          service.create(personId, { ...baseDto, delegateType: DelegateType.PARTNER, isPrimary: false }),
        ).resolves.toBeDefined();
      });
    });

    describe('update', () => {
      it('rejects promoting a delegate to primary for a Xicalla person when the type does not qualify', async () => {
        const delegate = {
          id: 'del-1',
          delegateType: DelegateType.PARTNER,
          isActive: true,
          isPrimary: false,
          person: xicallaPerson,
          user: { id: userId, person: null },
        };
        mockDelegateRepository.findOne.mockImplementation(updateFindOneImpl(delegate, null));

        await expect(
          service.update(personId, 'del-1', { isPrimary: true }),
        ).rejects.toThrow(BadRequestException);
        expect(dataSource.transaction).not.toHaveBeenCalled();
      });

      it('rejects promoting a delegate to primary for a Xicalla person when the manager has no qualifying non-Xicalla person', async () => {
        const delegate = {
          id: 'del-1',
          delegateType: DelegateType.PARENT,
          isActive: true,
          isPrimary: false,
          person: xicallaPerson,
          user: { id: userId, person: null },
        };
        mockDelegateRepository.findOne.mockImplementation(updateFindOneImpl(delegate, null));

        await expect(
          service.update(personId, 'del-1', { isPrimary: true }),
        ).rejects.toThrow(BadRequestException);
      });

      it('allows promoting a delegate to primary for a Xicalla person when the manager is self-managed', async () => {
        const delegate = {
          id: 'del-1',
          delegateType: DelegateType.PARENT,
          isActive: true,
          isPrimary: false,
          person: xicallaPerson,
          user: { id: userId, person: { id: 'parent-person' } },
        };
        mockDelegateRepository.findOne.mockImplementation(updateFindOneImpl(delegate, null));
        dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
          cb({ getRepository: () => txRepo }),
        );

        const result = await service.update(personId, 'del-1', { isPrimary: true });
        expect(result.isPrimary).toBe(true);
      });
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
        person: { id: 'person-1', user: null },
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

    it('should throw BadRequestException when promoting to primary a delegate of a person who already manages their own account', async () => {
      const existing = {
        id: 'del-1',
        delegateType: DelegateType.PARENT,
        isActive: true,
        isPrimary: false,
        person: { id: 'person-1', user: { id: 'self-user' } },
      };
      mockDelegateRepository.findOne.mockResolvedValue(existing);

      await expect(
        service.update('person-1', 'del-1', { isPrimary: true }),
      ).rejects.toThrow(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('demotePrimaryIfAny', () => {
    it('should unset isPrimary for the existing primary delegate of a person', async () => {
      await service.demotePrimaryIfAny('person-1');

      expect(mockDelegateRepository.update).toHaveBeenCalledWith(
        { person: { id: 'person-1' }, isPrimary: true },
        { isPrimary: false },
      );
    });

    it('should use the provided entity manager when given one, instead of the default repository', async () => {
      const manager = { getRepository: () => txRepo };

      await service.demotePrimaryIfAny('person-1', manager as never);

      expect(txRepo.update).toHaveBeenCalledWith(
        { person: { id: 'person-1' }, isPrimary: true },
        { isPrimary: false },
      );
      expect(mockDelegateRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('findProvisionalPrimaryDependents', () => {
    it('returns provisional persons where the user is the primary delegate', async () => {
      const userId = 'user-1';
      const dependents = [
        { id: 'del-1', isPrimary: true, person: { id: 'child-1', alias: '~child', isProvisional: true } },
      ];
      mockDelegateRepository.find.mockResolvedValue(dependents);

      const result = await service.findProvisionalPrimaryDependents(userId);

      expect(result).toEqual(dependents.map((d) => d.person));
      expect(mockDelegateRepository.find).toHaveBeenCalledWith({
        where: { user: { id: userId }, isPrimary: true, person: { isProvisional: true } },
        relations: ['person'],
      });
    });

    it('returns an empty array when there are no matching dependents', async () => {
      mockDelegateRepository.find.mockResolvedValue([]);

      const result = await service.findProvisionalPrimaryDependents('user-1');

      expect(result).toEqual([]);
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

  describe('assertPrimaryQualifiesForXicalla', () => {
    it('does not throw when the person has no primary delegate', async () => {
      mockDelegateRepository.findOne.mockResolvedValue(null);

      await expect(
        service.assertPrimaryQualifiesForXicalla('person-1'),
      ).resolves.toBeUndefined();
    });

    it('throws when the primary delegate type does not qualify', async () => {
      mockDelegateRepository.findOne.mockResolvedValue({
        id: 'del-1',
        isPrimary: true,
        delegateType: DelegateType.PARTNER,
        user: { id: 'user-1', person: null },
      });

      await expect(
        service.assertPrimaryQualifiesForXicalla('person-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when the primary delegate\'s manager has no qualifying non-Xicalla person', async () => {
      mockDelegateRepository.findOne.mockImplementation(
        (options: { where: { person?: { id?: string; isXicalla?: boolean } } }) => {
          if (options.where.person?.isXicalla === false) return Promise.resolve(null);
          return Promise.resolve({
            id: 'del-1',
            isPrimary: true,
            delegateType: DelegateType.PARENT,
            user: { id: 'user-1', person: null },
          });
        },
      );

      await expect(
        service.assertPrimaryQualifiesForXicalla('person-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not throw when the primary delegate\'s manager is self-managed', async () => {
      mockDelegateRepository.findOne.mockResolvedValue({
        id: 'del-1',
        isPrimary: true,
        delegateType: DelegateType.GUARDIAN,
        user: { id: 'user-1', person: { id: 'parent-person' } },
      });

      await expect(
        service.assertPrimaryQualifiesForXicalla('person-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertCanManagePerson', () => {
    it("does not throw when the person is the caller's own linked person", async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'person-1' },
      });

      await expect(
        service.assertCanManagePerson('user-1', 'person-1'),
      ).resolves.toBeUndefined();
      expect(mockDelegateRepository.findOne).not.toHaveBeenCalled();
    });

    it('does not throw when the caller is an active primary delegate for the person', async () => {
      mockUserRepository.findOne.mockResolvedValue({ id: 'user-1', person: null });
      mockDelegateRepository.findOne.mockResolvedValue({ id: 'del-1' });

      await expect(
        service.assertCanManagePerson('user-1', 'person-2'),
      ).resolves.toBeUndefined();
      expect(mockDelegateRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: 'user-1' },
          person: { id: 'person-2' },
          isPrimary: true,
          isActive: true,
        },
      });
    });

    it('throws ForbiddenException when the caller has no primary-delegate relation to the person', async () => {
      mockUserRepository.findOne.mockResolvedValue({ id: 'user-1', person: null });
      mockDelegateRepository.findOne.mockResolvedValue(null);

      await expect(
        service.assertCanManagePerson('user-1', 'person-2'),
      ).rejects.toThrow(ForbiddenException);
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

    it('should remove a primary delegate by default (admin behavior)', async () => {
      const existing = { id: 'del-1', isPrimary: true };
      mockDelegateRepository.findOne.mockResolvedValue(existing);
      mockDelegateRepository.remove.mockResolvedValue(existing);

      await service.remove('person-1', 'del-1');

      expect(mockDelegateRepository.remove).toHaveBeenCalledWith(existing);
    });

    it('should throw ForbiddenException when removing a primary delegate with allowPrimaryRemoval: false', async () => {
      const existing = { id: 'del-1', isPrimary: true };
      mockDelegateRepository.findOne.mockResolvedValue(existing);

      await expect(
        service.remove('person-1', 'del-1', { allowPrimaryRemoval: false }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDelegateRepository.remove).not.toHaveBeenCalled();
    });

    it('should remove a non-primary delegate with allowPrimaryRemoval: false', async () => {
      const existing = { id: 'del-1', isPrimary: false };
      mockDelegateRepository.findOne.mockResolvedValue(existing);
      mockDelegateRepository.remove.mockResolvedValue(existing);

      await service.remove('person-1', 'del-1', { allowPrimaryRemoval: false });

      expect(mockDelegateRepository.remove).toHaveBeenCalledWith(existing);
    });
  });
});
