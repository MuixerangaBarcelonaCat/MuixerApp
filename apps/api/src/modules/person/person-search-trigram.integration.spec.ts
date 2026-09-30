import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PersonService } from './person.service';
import { Person } from './person.entity';
import { Tag } from '../tag/tag.entity';
import { User } from '../user/user.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * The person search predicate was rewritten from `unaccent(col) ILIKE unaccent(:s)` to
 * `f_unaccent(lower(col)) LIKE f_unaccent(lower(:s))` so that it matches the expression the
 * trigram indexes are built on (AddPersonSearchTrigramIndexes). Two things need a real
 * database to check, and a mocked repository cannot see either:
 *
 *  1. `f_unaccent` exists and the generated SQL executes — the whole rewrite is a SQL string.
 *  2. The rewrite is accent- and case-insensitive in the same way the old predicate was.
 */
describe('person search — trigram-indexable predicate (integration)', () => {
  let db: IntegrationDb;
  let service: PersonService;

  const seeded = [
    { name: 'Mònica', firstSurname: 'Bonpàs', secondSurname: 'Ràfols', alias: 'trgm-monica' },
    { name: 'Joan', firstSurname: 'Serra', secondSurname: 'Puig', alias: 'trgm-joan' },
  ];

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        PersonDelegateService,
        ...realRepositoryProviders(db.dataSource, [Person, Tag, User, PersonDelegate]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();
    service = module.get(PersonService);

    await db.dataSource.getRepository(Person).save(seeded);
  });

  afterAll(async () => {
    const personRepo = db.dataSource.getRepository(Person);
    for (const person of seeded) await personRepo.delete({ alias: person.alias });
    await teardownIntegrationDb(db);
  });

  const search = async (term: string): Promise<string[]> => {
    const { data } = await service.findAll({ search: term, page: 1, limit: 50 });
    return data.map((p) => p.alias).filter((alias): alias is string => !!alias?.startsWith('trgm-'));
  };

  it('has f_unaccent installed and marked IMMUTABLE so it can be indexed', async () => {
    const [row] = await db.dataSource.query(
      `SELECT provolatile FROM pg_proc WHERE proname = 'f_unaccent'`,
    );
    expect(row?.provolatile).toBe('i');
  });

  it('resolves f_unaccent with an empty search_path, the way a pg_dump restore runs it', async () => {
    // Regression: with an unqualified body, `pg_dump | psql` restores the function fine but then
    // fails every `CREATE INDEX` that uses it — silently, because pg_dump sets `search_path = ''`
    // and `'unaccent'::regdictionary` no longer resolves. The restored database then has no
    // trigram indexes at all and nothing says so. Found by actually round-tripping a dump.
    await db.dataSource.query(`SET search_path = ''`);
    try {
      const [row] = await db.dataSource.query(`SELECT public.f_unaccent(lower('Mònica')) AS v`);
      expect(row.v).toBe('monica');
    } finally {
      await db.dataSource.query(`SET search_path = "$user", public`);
    }
  });

  it('created a trigram index per searchable person column', async () => {
    const rows: { indexname: string }[] = await db.dataSource.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'persons' AND indexname LIKE 'IDX_persons_trgm_%'`,
    );
    expect(rows.map((r) => r.indexname).sort()).toEqual([
      'IDX_persons_trgm_alias',
      'IDX_persons_trgm_firstsurname',
      'IDX_persons_trgm_name',
      'IDX_persons_trgm_secondsurname',
    ]);
  });

  it('produces a predicate the planner can answer from the trigram index', async () => {
    // With a two-row table a sequential scan always wins on cost, so the planner is told to
    // avoid one: what is being checked is that the index is *usable* for this predicate at all,
    // which is exactly what breaks if the query expression drifts from the indexed expression.
    await db.dataSource.query('SET enable_seqscan = off');
    try {
      const plan: { 'QUERY PLAN': string }[] = await db.dataSource.query(
        `EXPLAIN SELECT id FROM persons WHERE public.f_unaccent(lower("alias")) LIKE public.f_unaccent(lower('%onic%'))`,
      );
      expect(plan.map((r) => r['QUERY PLAN']).join('\n')).toContain('IDX_persons_trgm_alias');
    } finally {
      await db.dataSource.query('SET enable_seqscan = on');
    }
  });

  it('matches a name written without its accents', async () => {
    expect(await search('monica')).toEqual(['trgm-monica']);
  });

  it('matches an accented search term against the stored value', async () => {
    expect(await search('Mònica')).toEqual(['trgm-monica']);
  });

  it('stays case-insensitive, as the previous ILIKE predicate was', async () => {
    expect(await search('MONICA')).toEqual(['trgm-monica']);
  });

  it('matches on a substring in the middle of a column', async () => {
    expect(await search('onic')).toEqual(['trgm-monica']);
  });

  it('searches the surnames too, not only name and alias', async () => {
    expect(await search('bonpas')).toEqual(['trgm-monica']);
    expect(await search('rafols')).toEqual(['trgm-monica']);
  });

  it('returns nobody for a term that matches no column', async () => {
    expect(await search('zzzznomatch')).toEqual([]);
  });
});
