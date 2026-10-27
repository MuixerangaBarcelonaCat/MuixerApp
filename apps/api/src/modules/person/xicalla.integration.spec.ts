import { DataSource, Repository } from 'typeorm';
import { DEFAULT_COLLA_SETTINGS, deriveIsXicalla } from '@muixer/shared';
import { IntegrationDb, setupIntegrationDb, teardownIntegrationDb } from '../../test-integration/integration-db';
import { addDaysToDateOnly, getLocalToday } from '../../common/utils/date.util';
import { Person } from './person.entity';
import { xicallaSql } from './xicalla.sql';

/**
 * Proves the xicalla rule worked out on read: the SQL expression agrees with the TS mirror on the
 * edge cases, entity loads fill `isXicalla` on the main and joined aliases and accept it in a
 * `find` where, a new age of majority applies with no other write, and a missing settings row
 * falls back to the default age instead of turning every value NULL.
 */
describe('xicalla rule (integration)', () => {
  let db: IntegrationDb;
  let dataSource: DataSource;
  let persons: Repository<Person>;

  const yearsBefore = (date: string, years: number) => `${Number(date.slice(0, 4)) - years}${date.slice(4)}`;

  const setMajorityAge = (age: number) => dataSource.query(`UPDATE "colla_settings" SET "majorityAge" = $1`, [age]);

  const seed = (alias: string, birthDate: string | null, isXicallaManual: boolean, mentorId?: string) =>
    persons.save(
      persons.create({ name: alias, firstSurname: 'Test', alias, birthDate: birthDate as never, isXicallaManual, mentor: mentorId ? ({ id: mentorId } as Person) : null }),
    );

  beforeAll(async () => {
    db = await setupIntegrationDb();
    dataSource = db.dataSource;
    persons = dataSource.getRepository(Person);
  }, 180_000);

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  describe('SQL ≡ TS', () => {
    // [birthDate, today, majorityAge, isXicallaManual]
    const CASES: [string | null, string, number, boolean][] = [
      ['2010-05-12', '2026-05-12', 16, false], // birthday today
      ['2010-05-12', '2026-05-11', 16, false], // birthday tomorrow
      ['2010-05-13', '2026-05-12', 16, true], // a day short, manual flag ignored
      ['2008-02-29', '2025-02-28', 17, false], // leap birthday, non-leap year, day before
      ['2008-02-29', '2025-03-01', 17, false], // leap birthday, non-leap year, 1 March
      ['2024-02-29', '2028-02-29', 4, false], // leap birthday on a leap day
      ['2027-02-28', '2028-02-29', 1, false], // today is 29 February, target year isn't leap
      ['2027-03-01', '2028-02-29', 1, false],
      ['2000-01-01', '2026-10-13', 25, false],
      [null, '2026-10-13', 16, true], // no birth date → manual flag
      [null, '2026-10-13', 16, false],
    ];

    it.each(CASES)('birth %s on %s with majority %i (manual %s)', async (birthDate, today, majorityAge, isXicallaManual) => {
      await setMajorityAge(majorityAge);

      const [{ value }] = await dataSource.query(
        `SELECT ${xicallaSql('p', `'${today}'::date`)} AS value
         FROM (VALUES ($1::date, $2::boolean)) AS p("birthDate", "isXicallaManual")`,
        [birthDate, isXicallaManual],
      );

      expect(value).toBe(deriveIsXicalla({ birthDate, isXicallaManual }, majorityAge, today));
    });
  });

  describe('entity loads', () => {
    const today = getLocalToday();
    let adultId: string;
    let childId: string;

    beforeAll(async () => {
      await setMajorityAge(16);
      // Turns 16 today in Valencia time → adult; the child still has a day to go.
      const adult = await seed('adult', yearsBefore(today, 16), true);
      const child = await seed('child', addDaysToDateOnly(yearsBefore(today, 16), 1), false, adult.id);
      await seed('manual', null, true, child.id);
      adultId = adult.id;
      childId = child.id;
    });

    it('fills isXicalla on find, from the birth date in Valencia time', async () => {
      const all = await persons.find({ order: { alias: 'ASC' } });
      expect(all.map((p) => [p.alias, p.isXicalla])).toEqual([
        ['adult', false],
        ['child', true],
        ['manual', true],
      ]);
    });

    it('fills isXicalla on relations loaded by find', async () => {
      const child = await persons.findOneOrFail({ where: { id: childId }, relations: { mentor: true } });
      expect(child.mentor?.isXicalla).toBe(false);
    });

    it('fills isXicalla on query-builder joins', async () => {
      const manual = await persons
        .createQueryBuilder('person')
        .leftJoinAndSelect('person.mentor', 'mentor')
        .where('person.alias = :alias', { alias: 'manual' })
        .getOneOrFail();
      expect(manual.isXicalla).toBe(true);
      expect(manual.mentor?.isXicalla).toBe(true);
    });

    it('filters on isXicalla in a find where, also through a relation', async () => {
      const xicalla = await persons.find({ where: { isXicalla: true }, order: { alias: 'ASC' } });
      expect(xicalla.map((p) => p.alias)).toEqual(['child', 'manual']);

      const mentoredByAdult = await persons.find({ where: { mentor: { isXicalla: false } } });
      expect(mentoredByAdult.map((p) => p.alias)).toEqual(['child']);
    });

    it('applies a new age of majority with no other write', async () => {
      await setMajorityAge(17);
      expect((await persons.findOneByOrFail({ id: adultId })).isXicalla).toBe(true);
      await setMajorityAge(16);
      expect((await persons.findOneByOrFail({ id: adultId })).isXicalla).toBe(false);
    });

    it('falls back to the default age when the settings row is missing', async () => {
      await dataSource.query(`DELETE FROM "colla_settings"`);
      const all = await persons.find({ order: { alias: 'ASC' } });
      expect(DEFAULT_COLLA_SETTINGS.majorityAge).toBe(16);
      expect(all.map((p) => p.isXicalla)).toEqual([false, true, true]);
    });
  });
});
