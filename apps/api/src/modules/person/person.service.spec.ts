import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PersonService } from './person.service';
import { Person } from './person.entity';
import { Tag } from '../tag/tag.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { TagCategory } from '@muixer/shared';

describe('PersonService', () => {
  let service: PersonService;
  let personRepository: Repository<Person>;
  let positionRepository: Repository<Tag>;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
  };

  const mockPersonRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    query: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockPositionRepository = {
    findBy: jest.fn(),
    findOne: jest.fn(),
  };

  const mockPersonDelegateService = {
    getPrimary: jest.fn().mockResolvedValue(null),
    assertPrimaryQualifiesForXicalla: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        {
          provide: getRepositoryToken(Person),
          useValue: mockPersonRepository,
        },
        {
          provide: getRepositoryToken(Tag),
          useValue: mockPositionRepository,
        },
        {
          provide: PersonDelegateService,
          useValue: mockPersonDelegateService,
        },
      ],
    }).compile();

    service = module.get<PersonService>(PersonService);
    personRepository = module.get<Repository<Person>>(
      getRepositoryToken(Person),
    );
    positionRepository = module.get<Repository<Tag>>(
      getRepositoryToken(Tag),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a person when found', async () => {
      const mockPerson = { id: '123', name: 'Test', alias: 'test', user: null };
      mockPersonRepository.findOne.mockResolvedValue(mockPerson);

      const result = await service.findOne('123');

      expect(result).toMatchObject(mockPerson);
      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
        relations: ['positions', 'mentor', 'user'],
      });
    });

    it('should throw NotFoundException when person not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });

    it('should include gender in the response', async () => {
      const mockPerson = {
        id: '123',
        name: 'Test',
        alias: 'test',
        gender: 'MALE',
        user: null,
      };
      mockPersonRepository.findOne.mockResolvedValue(mockPerson);

      const result = await service.findOne('123');

      expect(result.gender).toBe('MALE');
    });

    it("should include isActive on the linked user's summary", async () => {
      const mockPerson = {
        id: '123',
        name: 'Test',
        alias: 'test',
        user: { id: 'u1', email: 'a@b.com', isActive: true },
      };
      mockPersonRepository.findOne.mockResolvedValue(mockPerson);

      const result = await service.findOne('123');

      expect(result.user?.isActive).toBe(true);
    });

    it('exposa tagCompliance calculada a partir de les etiquetes de la persona', async () => {
      mockPersonRepository.findOne.mockResolvedValue({
        id: 'p1',
        positions: [{ category: TagCategory.PINYA }, { category: TagCategory.TRONC }],
      } as unknown as Person);

      const result = await service.findOne('p1');

      expect(result.tagCompliance).toEqual({ ok: true, missing: [] });
    });

    it('marca la regla com a incomplida i diu què falta quan només té pinya', async () => {
      mockPersonRepository.findOne.mockResolvedValue({
        id: 'p1',
        positions: [{ category: TagCategory.PINYA }],
      } as unknown as Person);

      const result = await service.findOne('p1');

      expect(result.tagCompliance).toEqual({
        ok: false,
        missing: [TagCategory.TRONC],
      });
    });
  });

  describe('create', () => {
    it('should create a person without positions', async () => {
      const createDto = {
        name: 'Test',
        firstSurname: 'User',
        alias: 'testuser',
      };
      const mockPerson = { id: '123', ...createDto };

      mockPersonRepository.create.mockReturnValue(mockPerson);
      mockPersonRepository.save.mockResolvedValue(mockPerson);

      const result = await service.create(createDto);

      expect(result).toMatchObject(mockPerson);
      expect(mockPersonRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockPersonRepository.save).toHaveBeenCalledWith(mockPerson);
    });

    it('should create a person with positions', async () => {
      const createDto = {
        name: 'Test',
        firstSurname: 'User',
        alias: 'testuser',
        positionIds: ['pos1', 'pos2'],
      };
      const mockPositions = [
        { id: 'pos1', name: 'Position 1' },
        { id: 'pos2', name: 'Position 2' },
      ];
      const mockPerson = { id: '123', ...createDto, positions: mockPositions };

      mockPositionRepository.findBy.mockResolvedValue(mockPositions);
      mockPersonRepository.create.mockReturnValue(mockPerson);
      mockPersonRepository.save.mockResolvedValue(mockPerson);

      const result = await service.create(createDto);

      expect(result.id).toBe('123');
      expect(result.name).toBe('Test');
      expect(result.alias).toBe('testuser');
      expect(mockPositionRepository.findBy).toHaveBeenCalledWith({
        id: In(['pos1', 'pos2']),
      });
    });

    it('throws NotFoundException when a position id does not exist', async () => {
      const createDto = {
        name: 'Test',
        firstSurname: 'User',
        alias: 'testuser',
        positionIds: ['pos1', 'typo-id'],
      };
      mockPositionRepository.findBy.mockResolvedValue([
        { id: 'pos1', name: 'Position 1' },
      ]);
      mockPersonRepository.create.mockReturnValue({ id: '123', ...createDto });

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });

    it('assigna «Persona Nova» quan no ve cap etiqueta de xicalla ni d\'altres', async () => {
      const personaNova = { id: 'tag-nova', slug: 'persona-nova', category: TagCategory.PINYA } as Tag;
      mockPositionRepository.findOne.mockResolvedValue(personaNova);
      mockPersonRepository.create.mockImplementation((data) => data as Person);
      mockPersonRepository.save.mockImplementation(async (person) => person as Person);

      await service.create({ name: 'Nova', firstSurname: 'Persona', alias: 'nova' } as CreatePersonDto);

      const saved = mockPersonRepository.save.mock.calls[0][0] as Person;
      expect(saved.positions).toEqual([personaNova]);
    });

    it('no assigna cap etiqueta per defecte si ja en ve una de xicalla', async () => {
      const xicalla = { id: 'tag-xicalla', slug: 'xicalla', category: TagCategory.XICALLA } as Tag;
      mockPositionRepository.findBy.mockResolvedValue([xicalla]);
      mockPersonRepository.create.mockImplementation((data) => data as Person);
      mockPersonRepository.save.mockImplementation(async (person) => person as Person);

      await service.create({
        name: 'Menuda',
        firstSurname: 'Colla',
        alias: 'menuda',
        positionIds: ['tag-xicalla'],
      } as CreatePersonDto);

      const saved = mockPersonRepository.save.mock.calls[0][0] as Person;
      expect(saved.positions).toEqual([xicalla]);
      expect(mockPositionRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const mockPersons = [
        { id: '1', name: 'Person 1', alias: 'p1' },
        { id: '2', name: 'Person 2', alias: 'p2' },
      ];
      mockQueryBuilder.getCount.mockResolvedValue(2);
      mockQueryBuilder.getMany.mockResolvedValue(mockPersons);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.data).toMatchObject(mockPersons);
      expect(mockPersonRepository.createQueryBuilder).toHaveBeenCalledWith('person');
      expect(mockQueryBuilder.getCount).toHaveBeenCalled();
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('person.alias', 'ASC');
    });

    it('should order by name DESC when sort params provided', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, sortBy: 'name', sortOrder: 'DESC' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('person.name', 'DESC');
    });

    it('should order by shoulderHeight ASC', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, sortBy: 'shoulderHeight', sortOrder: 'ASC' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'person.shoulderHeight',
        'ASC',
      );
    });

    it('should apply isActive filter', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, isActive: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'person.isActive = :isActive',
        { isActive: true },
      );
    });

    const functionAndWhereCalls = () =>
      mockQueryBuilder.andWhere.mock.calls.filter(
        ([arg]) => typeof arg === 'function',
      );

    it('adds a single subquery andWhere when filtering by positionIds', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ positionIds: ['pos1'] } as any);

      expect(functionAndWhereCalls().length).toBe(1);
      expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith('positionIds', ['pos1']);
    });

    const tagRuleWhereClause = (): string | undefined =>
      mockQueryBuilder.andWhere.mock.calls
        .map(([arg]) => arg)
        .find((arg) => typeof arg === 'string' && arg.includes('person_positions'));

    it('applies the tagging rule as a negated EXISTS predicate when tagRuleOk is false', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ tagRuleOk: false } as any);

      const clause = tagRuleWhereClause();
      expect(clause).toBeDefined();
      expect(clause).toMatch(/^NOT /);
      expect(clause).toContain("t.category IN ('XICALLA', 'ALTRES')");
      expect(clause).toContain("t.category IN ('PINYA')");
      expect(clause).toContain("t.category IN ('TRONC')");
    });

    it('applies the tagging rule un-negated when tagRuleOk is true', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ tagRuleOk: true } as any);

      expect(tagRuleWhereClause()).not.toMatch(/^NOT /);
    });

    it('leaves the tagging rule out of the query when tagRuleOk is omitted', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10 });

      expect(tagRuleWhereClause()).toBeUndefined();
    });

    it('resols the season attendance count for the loaded page only and merges it per person', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(2);
      mockQueryBuilder.getMany.mockResolvedValue([
        { id: 'a', alias: 'a', positions: [] },
        { id: 'b', alias: 'b', positions: [] },
      ]);
      mockPersonRepository.query.mockResolvedValue([{ personId: 'b', count: 7 }]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(mockPersonRepository.query).toHaveBeenCalledWith(
        expect.stringContaining("a.status = 'ASSISTIT'"),
        [['a', 'b']],
      );
      expect(result.data.map((person) => person.attendedCount)).toEqual([0, 7]);
    });

    it('skips the attendance query entirely when the page is empty', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10 });

      expect(mockPersonRepository.query).not.toHaveBeenCalled();
    });

    it('orders by the attendance subquery alias when sortBy is attendedCount', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, sortBy: 'attendedCount', sortOrder: 'DESC' });

      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        expect.stringContaining("a.status = 'ASSISTIT'"),
        'attended_count',
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('attended_count', 'DESC');
    });

    it('does not add the attendance subquery to the query when sorting by something else', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, sortBy: 'alias' });

      expect(mockQueryBuilder.addSelect).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should deactivate a person without touching lastSyncedAt (that field belongs to the legacy sync)', async () => {
      const originalLastSyncedAt = new Date('2024-01-01');
      const mockPerson = {
        id: '123',
        name: 'Test',
        alias: 'test',
        isActive: true,
        lastSyncedAt: originalLastSyncedAt,
      };

      mockPersonRepository.findOne.mockResolvedValue(mockPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.softDelete('123');

      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
      });
      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          isActive: false,
          lastSyncedAt: originalLastSyncedAt,
        }),
      );
    });

    it('should throw NotFoundException when person not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      await expect(service.softDelete('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activate', () => {
    it('should activate a person without touching lastSyncedAt (that field belongs to the legacy sync)', async () => {
      const originalLastSyncedAt = new Date('2024-01-01');
      const mockPerson = {
        id: '123',
        name: 'Test',
        alias: 'test',
        isActive: false,
        lastSyncedAt: originalLastSyncedAt,
      };

      mockPersonRepository.findOne.mockResolvedValue(mockPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      const result = await service.activate('123');

      expect(result.isActive).toBe(true);
      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
        relations: ['positions', 'mentor'],
      });
      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          isActive: true,
          lastSyncedAt: originalLastSyncedAt,
        }),
      );
    });

    it('should throw NotFoundException when person not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      await expect(service.activate('999')).rejects.toThrow(NotFoundException);
    });
  });

  // --- createProvisional ---
  describe('createProvisional', () => {
    it('creates a provisional person with ~ prefix', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);
      const savedPerson = { id: 'prov-1', alias: '~Joan', name: 'Joan', firstSurname: '', isProvisional: true, isActive: true, positions: [] };
      mockPersonRepository.create.mockReturnValue(savedPerson);
      mockPersonRepository.save.mockResolvedValue(savedPerson);

      await service.createProvisional('Joan');

      expect(mockPersonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ alias: '~Joan', isProvisional: true, isActive: true }),
      );
    });

    it('throws ConflictException if ~ alias already exists', async () => {
      const existing = { id: 'prov-1', alias: '~Joan' };
      mockPersonRepository.findOne.mockResolvedValue(existing);

      await expect(service.createProvisional('Joan')).rejects.toThrow(ConflictException);
    });

    it('truncates alias to 20 chars when prefixed', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);
      const alias = 'MoltLlargAliasXXXXXX'; // 20 chars → ~MoltLlargAliasXXXXX (20 chars)
      const expected = `~${alias}`.slice(0, 20);
      const savedPerson = { id: 'p', alias: expected, name: alias, firstSurname: '', isProvisional: true, isActive: true, positions: [] };
      mockPersonRepository.create.mockReturnValue(savedPerson);
      mockPersonRepository.save.mockResolvedValue(savedPerson);

      await service.createProvisional(alias);

      expect(mockPersonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ alias: expected }),
      );
    });
  });

  // --- update provisional transitions ---
  describe('update provisional', () => {
    it('auto-prefixes ~ when demoting a regular person', async () => {
      const regularPerson = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      mockPersonRepository.findOne.mockResolvedValue(regularPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isProvisional: true });

      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ alias: '~Joan', isProvisional: true }),
      );
    });

    it('throws ConflictException (not a raw DB error) when demotion prefix collides with an existing alias', async () => {
      const regularPerson = { id: '1', alias: 'JoanExisting', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      const otherPerson = { id: '2', alias: '~JoanExisting' };
      mockPersonRepository.findOne
        .mockResolvedValueOnce(regularPerson)
        .mockResolvedValueOnce(otherPerson);

      await expect(service.update('1', { isProvisional: true })).rejects.toThrow(ConflictException);
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a plain alias update collides with another person', async () => {
      const person = { id: '1', alias: 'OldAlias', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      const otherPerson = { id: '2', alias: 'TakenAlias' };
      mockPersonRepository.findOne
        .mockResolvedValueOnce(person)
        .mockResolvedValueOnce(otherPerson);

      await expect(service.update('1', { alias: 'TakenAlias' })).rejects.toThrow(ConflictException);
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });

    it('allows updating alias when the new alias is free', async () => {
      const person = { id: '1', alias: 'OldAlias', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      mockPersonRepository.findOne
        .mockResolvedValueOnce(person)
        .mockResolvedValueOnce(null);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { alias: 'FreeAlias' });

      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'FreeAlias' }),
      );
    });

    it('throws BadRequestException when promoting without name', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: '', isProvisional: true, positions: [], mentor: null, user: { id: 'user_id' } };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);

      await expect(service.update('1', { isProvisional: false, alias: 'JoanNou' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when promoting without a manager (no self link, no primary delegate)', async () => {
      const provisionalPerson = {
        id: '1',
        alias: '~Joan',
        name: 'Joan',
        firstSurname: 'García',
        isProvisional: true,
        positions: [],
        mentor: null,
        user: null,
      };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);
      mockPersonDelegateService.getPrimary.mockResolvedValueOnce(null);

      await expect(
        service.update('1', { isProvisional: false, alias: 'JoanNou' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('loads the user relation so the promotion check sees it', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: 'García', isProvisional: true, positions: [], mentor: null, user: { id: 'user_id' } };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isProvisional: false, alias: 'JoanGarcia' });

      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['positions', 'mentor', 'user'],
      });
    });

    it('promotes when the person has a primary delegate even without a self link', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: 'García', isProvisional: true, positions: [], mentor: null, user: null };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));
      mockPersonDelegateService.getPrimary.mockResolvedValueOnce({ id: 'del-1', isPrimary: true });

      await service.update('1', { isProvisional: false, alias: 'JoanGarcia' });

      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isProvisional: false }),
      );
    });

    it('throws BadRequestException when promoting with ~ alias', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: 'García', isProvisional: true, positions: [], mentor: null, user: { id: 'user_id' } };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);

      await expect(service.update('1', { isProvisional: false, name: 'Joan', firstSurname: 'García' }))
        .rejects.toThrow(BadRequestException);
    });

    it('promotes provisional person when all fields provided', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: '', isProvisional: true, positions: [], mentor: null, user: { id: 'user_id' } };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isProvisional: false, alias: 'JoanGarcia', name: 'Joan', firstSurname: 'García' });

      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isProvisional: false, alias: 'JoanGarcia', firstSurname: 'García' }),
      );
    });
  });

  describe('update with an external transaction manager', () => {
    it('reads and writes through the manager repository instead of the injected one', async () => {
      const person = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      const managerPersonRepo = {
        findOne: jest.fn().mockResolvedValue(person),
        save: jest.fn().mockImplementation((p: Person) => Promise.resolve(p)),
      };
      const manager = { getRepository: jest.fn().mockReturnValue(managerPersonRepo) };

      await service.update('1', { name: 'Joan Updated' }, manager as never);

      expect(manager.getRepository).toHaveBeenCalledWith(Person);
      expect(managerPersonRepo.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['positions', 'mentor', 'user'],
      });
      expect(managerPersonRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Joan Updated' }),
      );
      expect(mockPersonRepository.findOne).not.toHaveBeenCalled();
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });

    it('still runs the alias-conflict check against the manager repository', async () => {
      const person = { id: '1', alias: 'OldAlias', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      const otherPerson = { id: '2', alias: 'TakenAlias' };
      const managerPersonRepo = {
        findOne: jest.fn().mockResolvedValueOnce(person).mockResolvedValueOnce(otherPerson),
        save: jest.fn(),
      };
      const manager = { getRepository: jest.fn().mockReturnValue(managerPersonRepo) };

      await expect(
        service.update('1', { alias: 'TakenAlias' }, manager as never),
      ).rejects.toThrow(ConflictException);
      expect(managerPersonRepo.save).not.toHaveBeenCalled();
      expect(mockPersonRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update positions', () => {
    it('throws NotFoundException when a position id does not exist', async () => {
      const person = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      mockPersonRepository.findOne.mockResolvedValue(person);
      mockPositionRepository.findBy.mockResolvedValue([{ id: 'pos1', name: 'Position 1' }]);

      await expect(
        service.update('1', { positionIds: ['pos1', 'typo-id'] }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });

    it('uses findBy/In to resolve positions', async () => {
      const person = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      const mockPositions = [{ id: 'pos1', name: 'Position 1' }];
      mockPersonRepository.findOne.mockResolvedValue(person);
      mockPositionRepository.findBy.mockResolvedValue(mockPositions);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { positionIds: ['pos1'] });

      expect(mockPositionRepository.findBy).toHaveBeenCalledWith({ id: In(['pos1']) });
    });
  });

  describe('update isXicalla toggle', () => {
    it('re-validates the existing primary delegate when isXicalla flips to true', async () => {
      const person = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, isXicalla: false, positions: [], mentor: null };
      mockPersonRepository.findOne.mockResolvedValue(person);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isXicalla: true });

      expect(mockPersonDelegateService.assertPrimaryQualifiesForXicalla).toHaveBeenCalledWith('1');
    });

    it('rejects the update when the current primary delegate no longer qualifies', async () => {
      const person = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, isXicalla: false, positions: [], mentor: null };
      mockPersonRepository.findOne.mockResolvedValue(person);
      mockPersonDelegateService.assertPrimaryQualifiesForXicalla.mockRejectedValueOnce(
        new BadRequestException('does not qualify'),
      );

      await expect(service.update('1', { isXicalla: true })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });

    it('does not re-validate when isXicalla is already true', async () => {
      const person = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, isXicalla: true, positions: [], mentor: null };
      mockPersonRepository.findOne.mockResolvedValue(person);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isXicalla: true });

      expect(mockPersonDelegateService.assertPrimaryQualifiesForXicalla).not.toHaveBeenCalled();
    });

    it('does not re-validate when isXicalla is being turned off', async () => {
      const person = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, isXicalla: true, positions: [], mentor: null };
      mockPersonRepository.findOne.mockResolvedValue(person);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isXicalla: false });

      expect(mockPersonDelegateService.assertPrimaryQualifiesForXicalla).not.toHaveBeenCalled();
    });
  });
});
