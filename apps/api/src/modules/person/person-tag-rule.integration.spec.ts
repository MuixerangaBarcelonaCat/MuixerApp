import { Test, TestingModule } from '@nestjs/testing';
import {
  IntegrationDb,
  realRepositoryProviders,
  setupIntegrationDb,
  teardownIntegrationDb,
} from '../../test-integration/integration-db';
import { PersonService } from './person.service';
import { Person } from './person.entity';
import { Tag } from '../tag/tag.entity';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';

/**
 * El filtre «no compleix la regla» ha de tornar exactament qui no satisfà cap de les tres
 * condicions. Una persona amb pinya + tronc és el cas normal i NO hi ha d'aparèixer.
 */
describe('Person tag rule filter (integration)', () => {
  let db: IntegrationDb;
  let service: PersonService;

  const insertPerson = async (alias: string, tagSlugs: string[]): Promise<string> => {
    const [person] = await db.dataSource.query(
      `INSERT INTO "persons" (name, "firstSurname", alias) VALUES ($1, 'Regla', $1) RETURNING id`,
      [alias],
    );
    if (tagSlugs.length > 0) {
      await db.dataSource.query(
        `INSERT INTO "person_positions" ("personsId", "positionsId")
         SELECT $1, id FROM "positions" WHERE slug = ANY($2::text[])`,
        [person.id, tagSlugs],
      );
    }
    return person.id;
  };

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        ...realRepositoryProviders(db.dataSource, [Person, Tag]),
        {
          provide: PersonDelegateService,
          useValue: {
            getPrimary: jest.fn().mockResolvedValue(null),
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

  it('inclou qui no té cap etiqueta i exclou els casos vàlids', async () => {
    const sense = await insertPerson('sense', []);
    const nomesPinya = await insertPerson('nomespinya', ['mans']);
    const pinyaITronc = await insertPerson('pinyatronc', ['mans', 'segona']);
    const nomesXicalla = await insertPerson('xicalleta', ['xicalla']);
    const nomesAltres = await insertPerson('acompanya', ['acompanyant']);

    const rows = await db.dataSource.query(
      `SELECT p.id FROM "persons" p
       WHERE NOT (
         EXISTS (SELECT 1 FROM "person_positions" pp JOIN "positions" t ON t.id = pp."positionsId"
                 WHERE pp."personsId" = p.id AND t.category IN ('XICALLA', 'ALTRES'))
         OR (
           EXISTS (SELECT 1 FROM "person_positions" pp JOIN "positions" t ON t.id = pp."positionsId"
                   WHERE pp."personsId" = p.id AND t.category = 'PINYA')
           AND EXISTS (SELECT 1 FROM "person_positions" pp JOIN "positions" t ON t.id = pp."positionsId"
                       WHERE pp."personsId" = p.id AND t.category = 'TRONC')
         )
       )`,
    );
    const ids = rows.map((row: { id: string }) => row.id);

    expect(ids).toContain(sense);
    expect(ids).toContain(nomesPinya);
    expect(ids).not.toContain(pinyaITronc);
    expect(ids).not.toContain(nomesXicalla);
    expect(ids).not.toContain(nomesAltres);
  });

  it('`tagRuleOk: false` a findAll torna els mateixos qui que la consulta de referència', async () => {
    const { data } = await service.findAll({ page: 1, limit: 100, tagRuleOk: false });
    const aliases = data.map((person) => person.alias).sort();

    expect(aliases).toEqual(['nomespinya', 'sense']);
    expect(data.every((person) => person.tagCompliance.ok === false)).toBe(true);
  });

  it('`tagRuleOk: true` a findAll torna la resta', async () => {
    const { data } = await service.findAll({ page: 1, limit: 100, tagRuleOk: true });
    const aliases = data.map((person) => person.alias).sort();

    expect(aliases).toEqual(['acompanya', 'pinyatronc', 'xicalleta']);
    expect(data.every((person) => person.tagCompliance.ok === true)).toBe(true);
  });

  it('compta les assistències de la temporada en curs i pot ordenar-hi', async () => {
    const [season] = await db.dataSource.query(
      `INSERT INTO "seasons" (name, "startDate", "endDate")
       VALUES ('Actual', CURRENT_DATE - 30, CURRENT_DATE + 30) RETURNING id`,
    );
    // Temporada passada: les seues assistències no han de comptar.
    const [old] = await db.dataSource.query(
      `INSERT INTO "seasons" (name, "startDate", "endDate")
       VALUES ('Passada', CURRENT_DATE - 400, CURRENT_DATE - 200) RETURNING id`,
    );

    const insertEvent = async (seasonId: string, title: string): Promise<string> => {
      const [event] = await db.dataSource.query(
        `INSERT INTO "events" ("eventType", title, date, "seasonId")
         VALUES ('ASSAIG', $1, CURRENT_DATE, $2) RETURNING id`,
        [title, seasonId],
      );
      return event.id;
    };

    const currentA = await insertEvent(season.id, 'A');
    const currentB = await insertEvent(season.id, 'B');
    const past = await insertEvent(old.id, 'C');

    const [{ id: senseId }] = await db.dataSource.query(
      `SELECT id FROM "persons" WHERE alias = 'sense'`,
    );
    const [{ id: pinyaId }] = await db.dataSource.query(
      `SELECT id FROM "persons" WHERE alias = 'nomespinya'`,
    );

    const attend = (personId: string, eventId: string, status: string) =>
      db.dataSource.query(
        `INSERT INTO "attendances" (status, "personId", "eventId") VALUES ($1, $2, $3)`,
        [status, personId, eventId],
      );

    await attend(senseId, currentA, 'ASSISTIT');
    await attend(senseId, currentB, 'ASSISTIT');
    await attend(senseId, past, 'ASSISTIT');
    await attend(pinyaId, currentA, 'NO_VAIG');

    const { data } = await service.findAll({
      page: 1,
      limit: 100,
      tagRuleOk: false,
      sortBy: 'attendedCount',
      sortOrder: 'DESC',
    });

    expect(data.map((person) => [person.alias, person.attendedCount])).toEqual([
      ['sense', 2],
      ['nomespinya', 0],
    ]);
  });
});
