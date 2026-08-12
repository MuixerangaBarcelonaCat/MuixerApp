import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PersonService } from '../person/person.service';
import { Person } from '../person/person.entity';
import { Tag } from '../tag/tag.entity';
import { User } from '../user/user.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { PERSON_SORT_BY_FIELDS } from '../person/constants/person-sort.constants';
import { UserService } from '../user/user.service';
import { TokenService } from '../auth/token.service';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { USER_SORT_BY_FIELDS } from '../user/constants/user-sort.constants';
import { EventService } from '../event/event.service';
import { SeasonService } from '../season/season.service';
import { Event } from '../event/event.entity';
import { Season } from '../season/season.entity';
import { Attendance } from '../event/attendance.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { EVENT_SORT_BY_FIELDS } from '../event/constants/event-sort.constants';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres regression suite for the BUG-3 class of bug: a `sortBy` whitelist entry that maps
 * to a column path TypeORM can build but Postgres rejects at execution time (e.g. BUG-3's
 * `user.person.alias`, a three-segment path that isn't resolvable against the query's join alias).
 * Mocked-repository unit tests never send the generated SQL to a real database, so they cannot catch
 * this — the query builder happily returns a mock, whether or not the string it built is valid SQL.
 * Every currently-whitelisted `sortBy` value, across every service that exposes one, is exercised here
 * against real Postgres. See TEST-2 in docs/automated-analyses/01-full-repo-audit.md.
 */
describe('sortBy whitelists execute valid SQL (integration)', () => {
  let db: IntegrationDb;

  beforeAll(async () => {
    db = await setupIntegrationDb();
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  describe('PersonService.findAll', () => {
    let service: PersonService;

    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PersonService,
          PersonDelegateService,
          ...realRepositoryProviders(db.dataSource, [Person, Tag, User, PersonDelegate]),
          { provide: DataSource, useValue: db.dataSource },
        ],
      }).compile();
      service = module.get(PersonService);
    });

    it.each(PERSON_SORT_BY_FIELDS)('sorts by %s without throwing', async (sortBy) => {
      await expect(service.findAll({ sortBy, page: 1, limit: 5 })).resolves.not.toThrow();
    });
  });

  describe('UserService.findAll', () => {
    let service: UserService;

    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UserService,
          TokenService,
          PersonDelegateService,
          ...realRepositoryProviders(db.dataSource, [User, Person, RefreshToken, PersonDelegate]),
          { provide: DataSource, useValue: db.dataSource },
        ],
      }).compile();
      service = module.get(UserService);
    });

    it.each(USER_SORT_BY_FIELDS)('sorts by %s without throwing', async (sortBy) => {
      await expect(service.findAll({ sortBy, page: 1, limit: 5 })).resolves.not.toThrow();
    });
  });

  describe('EventService.findAll', () => {
    let service: EventService;

    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EventService,
          SeasonService,
          ...realRepositoryProviders(db.dataSource, [Event, Season, Attendance, EventSegment]),
        ],
      }).compile();
      service = module.get(EventService);
    });

    it.each(EVENT_SORT_BY_FIELDS)('sorts by %s without throwing', async (sortBy) => {
      await expect(service.findAll({ sortBy, page: 1, limit: 5 })).resolves.not.toThrow();
    });
  });

  it('finds a real person through a whitelisted sort column end to end', async () => {
    const personRepo = db.dataSource.getRepository(Person);
    await personRepo.save({ name: 'Marc', firstSurname: 'Puig', alias: 'sortcheck' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        PersonDelegateService,
        ...realRepositoryProviders(db.dataSource, [Person, Tag, User, PersonDelegate]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();
    const service = module.get<PersonService>(PersonService);

    const { data } = await service.findAll({ sortBy: 'alias', sortOrder: 'DESC', page: 1, limit: 50 });

    expect(data.map((p) => p.alias)).toContain('sortcheck');

    await personRepo.delete({ alias: 'sortcheck' });
  });
});
