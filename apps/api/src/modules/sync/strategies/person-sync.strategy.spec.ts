import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonSyncStrategy } from './person-sync.strategy';
import { LegacyApiClient, LegacyPerson } from '../legacy-api.client';
import { Person } from '../../person/person.entity';
import { Position } from '../../position/position.entity';
import { AvailabilityStatus, OnboardingStatus } from '@muixer/shared';

// Helper to build a fluent QueryBuilder mock where getOne returns a configurable value
function makeQb(getOneResult: Person | null = null) {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn(),
    andWhere: jest.fn(),
    getOne: jest.fn().mockResolvedValue(getOneResult),
    update: jest.fn(),
    set: jest.fn(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  };
  qb['where'].mockReturnValue(qb);
  qb['andWhere'].mockReturnValue(qb);
  qb['update'].mockReturnValue(qb);
  qb['set'].mockReturnValue(qb);
  return qb;
}

describe('PersonSyncStrategy', () => {
  let strategy: PersonSyncStrategy;
  let legacyApiClient: jest.Mocked<LegacyApiClient>;
  let personRepository: jest.Mocked<Repository<Person>>;
  let positionRepository: jest.Mocked<Repository<Position>>;

  const mockLegacyPerson: LegacyPerson = {
    id: '123',
    nom: 'Joan',
    cognom1: 'Garcia',
    cognom2: 'Lopez',
    mote: 'Joani',
    posicio: 'PRIMERES',
    te_app: 'Sí',
    email: 'joan@example.com',
    data_naixement: '15/03/1990',
    telefon: '612345678',
    instant_camisa: '01/01/2020',
    alcada_espatlles: '150',
    revisat: 'Sí',
    estat_acollida: 'Finalitzat',
    llistes: '',
    tecnica: '',
    propi: 'Sí',
    lesionat: 'No',
    n_assistencies: '50',
    observacions: 'Test notes',
    import_quota: '100',
  };

  function buildModule(qbFactory: () => ReturnType<typeof makeQb>) {
    const mockPersonRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(qbFactory),
    };

    const mockPositionRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const mockLegacyClient = {
      login: jest.fn(),
      getCastellers: jest.fn(),
    };

    return { mockPersonRepo, mockPositionRepo, mockLegacyClient };
  }

  async function createModule(qbFactory: () => ReturnType<typeof makeQb>) {
    const { mockPersonRepo, mockPositionRepo, mockLegacyClient } = buildModule(qbFactory);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonSyncStrategy,
        { provide: LegacyApiClient, useValue: mockLegacyClient },
        { provide: getRepositoryToken(Person), useValue: mockPersonRepo },
        { provide: getRepositoryToken(Position), useValue: mockPositionRepo },
      ],
    }).compile();

    return {
      strategy: module.get<PersonSyncStrategy>(PersonSyncStrategy),
      legacyApiClient: module.get(LegacyApiClient) as jest.Mocked<LegacyApiClient>,
      personRepository: module.get(getRepositoryToken(Person)) as jest.Mocked<Repository<Person>>,
      positionRepository: module.get(getRepositoryToken(Position)) as jest.Mocked<Repository<Position>>,
    };
  }

  beforeEach(async () => {
    // Default setup: no alias conflicts (getOne returns null)
    const result = await createModule(() => makeQb(null));
    strategy = result.strategy;
    legacyApiClient = result.legacyApiClient;
    personRepository = result.personRepository;
    positionRepository = result.positionRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── execute() integration tests ────────────────────────────────────────────

  describe('execute()', () => {
    it('emits start → progress* → complete on successful sync', (done) => {
      legacyApiClient.login.mockResolvedValue();
      legacyApiClient.getCastellers.mockResolvedValue([mockLegacyPerson]);
      positionRepository.findOne.mockResolvedValue(null);
      positionRepository.create.mockReturnValue({} as Position);
      positionRepository.save.mockResolvedValue({} as Position);
      personRepository.findOne.mockResolvedValue(null);
      personRepository.create.mockReturnValue({} as Person);
      personRepository.save.mockResolvedValue({} as Person);

      const events: any[] = [];
      strategy.execute().subscribe({
        next: (e) => events.push(e),
        complete: () => {
          expect(events[0].type).toBe('start');
          expect(events[events.length - 1].type).toBe('complete');
          done();
        },
      });
    });

    it('prevents concurrent syncs — second call emits error immediately', (done) => {
      legacyApiClient.login.mockResolvedValue();
      legacyApiClient.getCastellers.mockResolvedValue([mockLegacyPerson]);
      personRepository.findOne.mockResolvedValue(null);
      personRepository.create.mockReturnValue({} as Person);
      personRepository.save.mockResolvedValue({} as Person);

      strategy.execute().subscribe();

      strategy.execute().subscribe({
        next: (event) => {
          expect(event.type).toBe('error');
          expect(event.message).toContain('already in progress');
          done();
        },
      });
    });

    it('emits error event on login failure, does not throw', (done) => {
      legacyApiClient.login.mockRejectedValue(new Error('Login failed'));

      const events: any[] = [];
      strategy.execute().subscribe({
        next: (e) => events.push(e),
        complete: () => {
          const err = events.find((e) => e.type === 'error');
          expect(err).toBeDefined();
          expect(err.message).toContain('Login failed');
          done();
        },
      });
    });
  });

  // ─── CREATE path ─────────────────────────────────────────────────────────────

  describe('createPerson()', () => {
    it('maps all legacy fields correctly', (done) => {
      legacyApiClient.login.mockResolvedValue();
      legacyApiClient.getCastellers.mockResolvedValue([mockLegacyPerson]);
      positionRepository.findOne.mockResolvedValue(null);
      positionRepository.create.mockReturnValue({} as Position);
      positionRepository.save.mockResolvedValue({} as Position);
      personRepository.findOne.mockResolvedValue(null);
      personRepository.create.mockImplementation((d) => d as Person);
      personRepository.save.mockResolvedValue({} as Person);

      strategy.execute().subscribe({
        complete: () => {
          expect(personRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
              legacyId: '123',
              name: 'Joan',
              firstSurname: 'Garcia',
              secondSurname: 'Lopez',
              alias: 'Joani',
              email: 'joan@example.com',
              isMember: true,
              availability: AvailabilityStatus.AVAILABLE,
              onboardingStatus: OnboardingStatus.COMPLETED,
              notes: 'Test notes',
            }),
          );
          done();
        },
      });
    });
  });

  // ─── UPDATE path ─────────────────────────────────────────────────────────────

  describe('updatePerson()', () => {
    it('updates identity fields and preserves positions and notes', (done) => {
      const existingPerson = {
        id: 'uuid-1',
        legacyId: '123',
        name: 'OldName',
        positions: [{ id: 'pos-1', name: 'Primeres', slug: 'primeres' }],
        notes: 'Old notes',
      } as Person;

      legacyApiClient.login.mockResolvedValue();
      legacyApiClient.getCastellers.mockResolvedValue([mockLegacyPerson]);
      personRepository.findOne.mockResolvedValue(existingPerson);
      personRepository.save.mockResolvedValue(existingPerson);

      strategy.execute().subscribe({
        complete: () => {
          expect(personRepository.save).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Joan', legacyId: '123' }),
          );
          // MuixerApp-owned fields NEVER overwritten
          expect(existingPerson.positions).toEqual([{ id: 'pos-1', name: 'Primeres', slug: 'primeres' }]);
          expect(existingPerson.notes).toBe('Old notes');
          done();
        },
      });
    });
  });

  // ─── deriveUniqueAlias — alias resolution logic ───────────────────────────────

  describe('deriveUniqueAlias()', () => {
    const person: LegacyPerson = {
      ...mockLegacyPerson,
      id: '42',
      nom: 'Nacho',
      cognom1: 'Amic',
      cognom2: 'Jordi',
      mote: 'NACHO',
    };

    it('returns base alias when no conflict', async () => {
      // createQueryBuilder always returns no conflict
      const result = await createModule(() => makeQb(null));
      result.legacyApiClient.login.mockResolvedValue();
      result.legacyApiClient.getCastellers.mockResolvedValue([{ ...person, mote: 'NACHO' }]);
      result.personRepository.findOne.mockResolvedValue(null);
      result.personRepository.create.mockImplementation((d) => d as Person);
      result.personRepository.save.mockResolvedValue({} as Person);

      await new Promise<void>((resolve) => {
        result.strategy.execute().subscribe({
          complete: () => {
            expect(result.personRepository.create).toHaveBeenCalledWith(
              expect.objectContaining({ alias: 'NACHO' }),
            );
            resolve();
          },
        });
      });
    });

    it('falls back to mote+cognom1 when base alias is taken', async () => {
      // First call (base alias check) → conflict; subsequent → free
      let callCount = 0;
      const result = await createModule(() => {
        const qb = makeQb(null);
        qb['getOne'].mockImplementation(() => {
          callCount++;
          return Promise.resolve(callCount === 1 ? ({ id: 'other' } as Person) : null);
        });
        return qb;
      });

      result.legacyApiClient.login.mockResolvedValue();
      result.legacyApiClient.getCastellers.mockResolvedValue([person]);
      result.personRepository.findOne.mockResolvedValue(null);
      result.personRepository.create.mockImplementation((d) => d as Person);
      result.personRepository.save.mockResolvedValue({} as Person);

      await new Promise<void>((resolve) => {
        result.strategy.execute().subscribe({
          complete: () => {
            const created = result.personRepository.create.mock.calls[0][0] as Person;
            // base "NACHO" was taken → should use "NACHO Amic" (truncated to 20)
            expect(created.alias).toBe('NACHO Amic');
            resolve();
          },
        });
      });
    });

    it('falls back to numbered suffix (base_2) when first three candidates are taken', async () => {
      let callCount = 0;
      const result = await createModule(() => {
        const qb = makeQb(null);
        // First 3 candidates occupied, 4th free
        qb['getOne'].mockImplementation(() => {
          callCount++;
          return Promise.resolve(callCount <= 3 ? ({ id: 'other' } as Person) : null);
        });
        return qb;
      });

      result.legacyApiClient.login.mockResolvedValue();
      result.legacyApiClient.getCastellers.mockResolvedValue([person]);
      result.personRepository.findOne.mockResolvedValue(null);
      result.personRepository.create.mockImplementation((d) => d as Person);
      result.personRepository.save.mockResolvedValue({} as Person);

      await new Promise<void>((resolve) => {
        result.strategy.execute().subscribe({
          complete: () => {
            const created = result.personRepository.create.mock.calls[0][0] as Person;
            expect(created.alias).toBe('NACHO_2');
            resolve();
          },
        });
      });
    });

    it('falls back to id_<legacyId> when all 11 candidates are taken', async () => {
      const result = await createModule(() => {
        const qb = makeQb({ id: 'other' } as Person); // all calls return conflict
        return qb;
      });

      result.legacyApiClient.login.mockResolvedValue();
      result.legacyApiClient.getCastellers.mockResolvedValue([person]);
      result.personRepository.findOne.mockResolvedValue(null);
      result.personRepository.create.mockImplementation((d) => d as Person);
      result.personRepository.save.mockResolvedValue({} as Person);

      await new Promise<void>((resolve) => {
        result.strategy.execute().subscribe({
          complete: () => {
            const created = result.personRepository.create.mock.calls[0][0] as Person;
            expect(created.alias).toBe('id_42');
            resolve();
          },
        });
      });
    });

    it('UPDATE path calls andWhere with excludeId to skip self', async () => {
      const existingPerson = {
        id: 'uuid-existing',
        legacyId: '42',
        name: 'Old',
        positions: [],
        notes: null,
      } as unknown as Person;

      // Track all andWhere calls across all qb instances
      const andWhereCalls: Array<[string, Record<string, unknown>]> = [];

      const result = await createModule(() => {
        const qb = makeQb(null);
        qb['andWhere'].mockImplementation((condition: string, params: Record<string, unknown>) => {
          andWhereCalls.push([condition, params]);
          return qb;
        });
        return qb;
      });

      result.legacyApiClient.login.mockResolvedValue();
      result.legacyApiClient.getCastellers.mockResolvedValue([person]);
      result.personRepository.findOne.mockResolvedValue(existingPerson);
      result.personRepository.save.mockResolvedValue(existingPerson);

      await new Promise<void>((resolve) => {
        result.strategy.execute().subscribe({
          complete: () => {
            const excludeCall = andWhereCalls.find(
              ([, params]) => Object.values(params).includes('uuid-existing'),
            );
            expect(excludeCall).toBeDefined();
            resolve();
          },
        });
      });
    });
  });

  // ─── parseTimestamp / mappers (pure functions) ───────────────────────────────

  describe('mappers', () => {
    it('maps injured person to LONG_TERM_UNAVAILABLE', (done) => {
      const injured: LegacyPerson = { ...mockLegacyPerson, lesionat: 'Sí' };
      legacyApiClient.login.mockResolvedValue();
      legacyApiClient.getCastellers.mockResolvedValue([injured]);
      personRepository.findOne.mockResolvedValue(null);
      personRepository.create.mockImplementation((d) => d as Person);
      personRepository.save.mockResolvedValue({} as Person);

      strategy.execute().subscribe({
        complete: () => {
          expect(personRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ availability: AvailabilityStatus.LONG_TERM_UNAVAILABLE }),
          );
          done();
        },
      });
    });

    it('marks xicalla from CANALLA position', (done) => {
      const xicalla: LegacyPerson = { ...mockLegacyPerson, posicio: 'CANALLA' };
      legacyApiClient.login.mockResolvedValue();
      legacyApiClient.getCastellers.mockResolvedValue([xicalla]);
      personRepository.findOne.mockResolvedValue(null);
      personRepository.create.mockImplementation((d) => d as Person);
      personRepository.save.mockResolvedValue({} as Person);

      strategy.execute().subscribe({
        complete: () => {
          expect(personRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ isXicalla: true }),
          );
          done();
        },
      });
    });
  });
});
