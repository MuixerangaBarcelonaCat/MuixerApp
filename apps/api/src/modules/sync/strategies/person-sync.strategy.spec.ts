import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonSyncStrategy } from './person-sync.strategy';
import { LegacyApiClient, LegacyPerson } from '../legacy-api.client';
import { Person } from '../../person/person.entity';
import { Position } from '../../position/position.entity';
import { AvailabilityStatus, OnboardingStatus, FigureZone } from '@muixer/shared';

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

  beforeEach(async () => {
    const qb = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    qb.update.mockReturnValue(qb);
    qb.set.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);

    const mockPersonRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => qb),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonSyncStrategy,
        {
          provide: LegacyApiClient,
          useValue: mockLegacyClient,
        },
        {
          provide: getRepositoryToken(Person),
          useValue: mockPersonRepo,
        },
        {
          provide: getRepositoryToken(Position),
          useValue: mockPositionRepo,
        },
      ],
    }).compile();

    strategy = module.get<PersonSyncStrategy>(PersonSyncStrategy);
    legacyApiClient = module.get(LegacyApiClient);
    personRepository = module.get(getRepositoryToken(Person));
    positionRepository = module.get(getRepositoryToken(Position));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should sync persons successfully', (done) => {
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
        next: (event) => events.push(event),
        complete: () => {
          expect(events.length).toBeGreaterThan(0);
          expect(events[0].type).toBe('start');
          expect(events[events.length - 1].type).toBe('complete');
          done();
        },
      });
    });

    it('should prevent concurrent syncs', (done) => {
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

    it('should create new person with all fields', (done) => {
      legacyApiClient.login.mockResolvedValue();
      legacyApiClient.getCastellers.mockResolvedValue([mockLegacyPerson]);

      positionRepository.findOne.mockResolvedValue(null);
      positionRepository.create.mockReturnValue({} as Position);
      positionRepository.save.mockResolvedValue({} as Position);

      personRepository.findOne.mockResolvedValue(null);
      personRepository.create.mockImplementation((data) => data as Person);
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

    it('should update existing person without changing positions/notes', (done) => {
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
            expect.objectContaining({
              name: 'Joan',
              legacyId: '123',
            }),
          );
          expect(existingPerson.positions).toEqual([{ id: 'pos-1', name: 'Primeres', slug: 'primeres' }]);
          expect(existingPerson.notes).toBe('Old notes');
          done();
        },
      });
    });

    it('should handle errors gracefully', (done) => {
      legacyApiClient.login.mockRejectedValue(new Error('Login failed'));

      const events: any[] = [];

      strategy.execute().subscribe({
        next: (event) => events.push(event),
        complete: () => {
          const errorEvent = events.find((e) => e.type === 'error');
          expect(errorEvent).toBeDefined();
          expect(errorEvent.message).toContain('Login failed');
          done();
        },
      });
    });
  });
});
