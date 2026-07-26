import { Test, TestingModule } from '@nestjs/testing';
import { EventType } from '@muixer/shared';
import { AvailablePersonsService } from './available-persons.service';
import { Person } from '../person/person.entity';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { NodeAssignment } from './entities/node-assignment.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres regression suite for BUG-16 (fuzzy search ordering ignored name similarity) and,
 * more generally, for the `unaccent`/`pg_trgm` extension + `word_similarity` SQL this service relies
 * on — the exact class of bug (invalid/incomplete raw SQL) that mocked-repository unit tests cannot
 * catch. See TEST-2 in docs/automated-analyses/01-full-repo-audit.md.
 */
describe('AvailablePersonsService (integration)', () => {
  let db: IntegrationDb;
  let service: AvailablePersonsService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailablePersonsService,
        ...realRepositoryProviders(db.dataSource, [Person, Attendance, Event, EventSegment, NodeAssignment]),
      ],
    }).compile();

    service = module.get(AvailablePersonsService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  async function makeSegment() {
    const event = await db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Assaig de prova',
      date: new Date('2026-01-01'),
    });
    const segment = await db.dataSource.getRepository(EventSegment).save({
      event,
      sortOrder: 0,
    });
    return { event, segment };
  }

  it('finds a person who only matches by name, not alias', async () => {
    const { event, segment } = await makeSegment();
    const personRepo = db.dataSource.getRepository(Person);

    await personRepo.save({ name: 'Pere', firstSurname: 'Fontanals', alias: 'capgros' });
    await personRepo.save({ name: 'Anna', firstSurname: 'Soler', alias: 'baixet' });

    const results = await service.getAvailablePersons(event.id, segment.id, { search: 'pere' });

    expect(results.map((r) => r.alias)).toContain('capgros');
    expect(results.map((r) => r.alias)).not.toContain('baixet');
  });

  it('ranks a strong name-only match above a weak alias-only match (BUG-16: ORDER BY used to score alias only)', async () => {
    const { event, segment } = await makeSegment();
    const personRepo = db.dataSource.getRepository(Person);

    // weak alias match to 'pere' (partial trigram overlap), unrelated name
    await personRepo.save({ name: 'Uncorrelated Text', firstSurname: 'Surname', alias: 'perex' });
    // no alias similarity at all, but an exact name match to 'pere'
    await personRepo.save({ name: 'Pere', firstSurname: 'Surname', alias: 'zzzabc' });

    const results = await service.getAvailablePersons(event.id, segment.id, { search: 'pere' });
    const order = results.map((r) => r.alias);

    expect(order).toEqual(['zzzabc', 'perex']);
  });

  it('is accent-insensitive on both alias and name (real unaccent extension)', async () => {
    const { event, segment } = await makeSegment();
    const personRepo = db.dataSource.getRepository(Person);

    await personRepo.save({ name: 'Núria', firstSurname: 'Àlvarez', alias: 'nuri' });

    const results = await service.getAvailablePersons(event.id, segment.id, { search: 'nuria' });

    expect(results.map((r) => r.alias)).toContain('nuri');
  });

  it('executes without throwing when there is no search term', async () => {
    const { event, segment } = await makeSegment();
    await db.dataSource.getRepository(Person).save({ name: 'Marc', firstSurname: 'Puig', alias: 'marcus' });

    await expect(service.getAvailablePersons(event.id, segment.id, {})).resolves.not.toThrow();
  });
});
