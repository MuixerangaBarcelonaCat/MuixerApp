import { Test, TestingModule } from '@nestjs/testing';
import {
  IntegrationDb,
  realRepositoryProviders,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
} from '../../test-integration/integration-db';
import { PersonService } from './person.service';
import { Person } from './person.entity';
import { Tag } from '../tag/tag.entity';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { CollaSettingsService } from '../colla-settings/colla-settings.service';
import { CollaSettingsStub } from '../colla-settings/colla-settings.stub';

/**
 * PersonService over real Postgres for the derived xicalla: the list filters and sorts by the
 * effective value, writes land on `isXicallaManual` only while the birth date is unknown, and every
 * response carries the value the database works out — never the one the client sent.
 */
describe('PersonService xicalla (integration)', () => {
  let db: IntegrationDb;
  let service: PersonService;

  const save = (alias: string, birthDate: string | null, isXicallaManual: boolean) =>
    db.dataSource.getRepository(Person).save({ name: alias, firstSurname: 'Test', alias, birthDate: birthDate as never, isXicallaManual });

  const stored = (id: string) =>
    db.dataSource.query(`SELECT "birthDate"::text, "isXicallaManual" FROM "persons" WHERE id = $1`, [id]).then((r) => r[0]);

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: CollaSettingsService, useValue: new CollaSettingsStub() },
        PersonService,
        ...realRepositoryProviders(db.dataSource, [Person, Tag]),
        {
          provide: PersonDelegateService,
          useValue: {
            getPrimary: jest.fn().mockResolvedValue(null),
            findPersonIdsWithResponsible: jest.fn().mockResolvedValue(new Set()),
            assertPrimaryQualifiesForXicalla: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(PersonService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
    await db.dataSource.query(`INSERT INTO "colla_settings" DEFAULT VALUES`);
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await save('kid', '2020-01-01', false);
      await save('adult', '1990-01-01', true);
      await save('nobd', null, true);
    });

    it('filters by the effective value', async () => {
      const xicalla = await service.findAll({ isXicalla: true, sortBy: 'alias' });
      expect(xicalla.data.map((p) => [p.alias, p.isXicalla])).toEqual([
        ['kid', true],
        ['nobd', true],
      ]);

      const adults = await service.findAll({ isXicalla: false });
      expect(adults.data.map((p) => p.alias)).toEqual(['adult']);
    });

    it('sorts by the effective value, with pagination', async () => {
      const page = await service.findAll({ sortBy: 'isXicalla', sortOrder: 'ASC', limit: 1, page: 1 });
      expect(page.total).toBe(3);
      expect(page.data.map((p) => p.alias)).toEqual(['adult']);
    });
  });

  describe('create', () => {
    it('stores the flag as manual when there is no birth date', async () => {
      const created = await service.create({ name: 'Nil', firstSurname: 'Test', alias: 'nil', isXicalla: true });
      expect(created.isXicalla).toBe(true);
      expect(await stored(created.id)).toEqual({ birthDate: null, isXicallaManual: true });
    });

    it('ignores the flag and answers with the derived value when the birth date is known', async () => {
      const created = await service.create({ name: 'Pau', firstSurname: 'Test', alias: 'pau', birthDate: '1990-01-01', isXicalla: true });
      expect(created.isXicalla).toBe(false);
      expect((await stored(created.id)).isXicallaManual).toBe(false);
    });

    it('answers with the derived value when the client sends no flag', async () => {
      const created = await service.create({ name: 'Mar', firstSurname: 'Test', alias: 'mar', birthDate: '2020-01-01' });
      expect(created.isXicalla).toBe(true);
    });
  });

  describe('createProvisional', () => {
    it('answers with the derived value, not an unset one', async () => {
      const created = await service.createProvisional('nou');
      expect(created.isXicalla).toBe(false);
    });

    it('marks a new provisional person as xicalla by the manual flag', async () => {
      const created = await service.createProvisional('petita', true);
      expect(created.isXicalla).toBe(true);
      expect((await stored(created.id)).isXicallaManual).toBe(true);
    });
  });

  describe('update', () => {
    it('ignores the flag while the birth date is known, keeping the stored manual value', async () => {
      const person = await save('kid', '2020-01-01', true);
      const updated = await service.update(person.id, { isXicalla: false });
      expect(updated.isXicalla).toBe(true);
      expect((await stored(person.id)).isXicallaManual).toBe(true);
    });

    it('answers with the new derived value after the birth date changes', async () => {
      const person = await save('kid', '2020-01-01', false);
      const updated = await service.update(person.id, { birthDate: '1990-01-01' });
      expect(updated.isXicalla).toBe(false);
    });

    it('stores the flag as manual once the birth date is cleared in the same request', async () => {
      const person = await save('kid', '2020-01-01', false);
      const updated = await service.update(person.id, { birthDate: null, isXicalla: true });
      expect(updated.isXicalla).toBe(true);
      expect(await stored(person.id)).toEqual({ birthDate: null, isXicallaManual: true });
    });

    it('brings back the stored manual value when the birth date is cleared without a flag', async () => {
      const person = await save('kid', '2020-01-01', false);
      const updated = await service.update(person.id, { birthDate: null });
      expect(updated.isXicalla).toBe(false);
    });
  });
});
