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
import { CollaSettingsService } from '../colla-settings/colla-settings.service';
import { CollaSettingsStub } from '../colla-settings/colla-settings.stub';

/**
 * La camisa es guanya amb 2 actuacions i 6 assajos amb assistència marcada (`ASSISTIT`),
 * comptant només els esdeveniments que compten per a estadístiques, de qualsevol temporada.
 */
describe('Person shirt candidates (integration)', () => {
  let db: IntegrationDb;
  let service: PersonService;

  const insertPerson = async (
    alias: string,
    extra: { shirtDate?: string; isActive?: boolean; isProvisional?: boolean } = {},
  ): Promise<string> => {
    const [person] = await db.dataSource.query(
      `INSERT INTO "persons" (name, "firstSurname", alias, "shirtDate", "isActive", "isProvisional")
       VALUES ($1, 'Camisa', $1, $2, $3, $4) RETURNING id`,
      [alias, extra.shirtDate ?? null, extra.isActive ?? true, extra.isProvisional ?? false],
    );
    return person.id;
  };

  const insertEvent = async (
    eventType: 'ASSAIG' | 'ACTUACIO',
    countsForStatistics = true,
    daysFromToday = -10,
  ): Promise<string> => {
    const [event] = await db.dataSource.query(
      `INSERT INTO "events" ("eventType", title, date, "countsForStatistics")
       VALUES ($1, 'Esdeveniment', CURRENT_DATE + $2::int, $3) RETURNING id`,
      [eventType, daysFromToday, countsForStatistics],
    );
    return event.id;
  };

  const attend = async (personId: string, eventIds: string[], status = 'ASSISTIT') => {
    for (const eventId of eventIds) {
      await db.dataSource.query(
        `INSERT INTO "attendances" (status, "personId", "eventId") VALUES ($1, $2, $3)`,
        [status, personId, eventId],
      );
    }
  };

  const times = <T>(n: number, fn: () => Promise<T>): Promise<T[]> =>
    Promise.all(Array.from({ length: n }, fn));

  let performances: string[];
  let rehearsals: string[];

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
            assertPrimaryQualifiesForXicalla: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(PersonService);

    // Repartides en dues temporades diferents: el recompte és de tota la història.
    performances = [
      await insertEvent('ACTUACIO', true, -10),
      await insertEvent('ACTUACIO', true, -500),
      await insertEvent('ACTUACIO', true, -20),
    ];
    rehearsals = await times(8, () => insertEvent('ASSAIG'));
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('compta només ASSISTIT, separat per tipus, i marca qui té dret amb 2 + 6 exactes', async () => {
    const dret = await insertPerson('dret');
    await attend(dret, [...performances.slice(0, 2), ...rehearsals.slice(0, 6)]);

    const confirmat = await insertPerson('confirmat');
    await attend(confirmat, [performances[0]], 'ASSISTIT');
    await attend(confirmat, [performances[1]], 'ANIRE');
    await attend(confirmat, rehearsals.slice(0, 3), 'NO_VAIG');

    const candidates = await service.findShirtCandidates();
    const byId = new Map(candidates.map((c) => [c.id, c]));

    expect(byId.get(dret)).toEqual(
      expect.objectContaining({
        performancesAttended: 2,
        rehearsalsAttended: 6,
        isEligible: true,
        missingTotal: 0,
      }),
    );
    expect(byId.get(confirmat)).toEqual(
      expect.objectContaining({
        performancesAttended: 1,
        rehearsalsAttended: 0,
        isEligible: false,
        missingTotal: 7,
      }),
    );
  });

  it('torna la data del darrer esdeveniment comptat amb assistència marcada', async () => {
    const recent = await insertEvent('ASSAIG', true, -3);
    const futurNoComptat = await insertEvent('ASSAIG', false, -1);
    const person = await insertPerson('darrera');
    await attend(person, [performances[1], recent, futurNoComptat]);
    await attend(person, [rehearsals[0]], 'ANIRE');

    const [{ expected }] = await db.dataSource.query(
      `SELECT (CURRENT_DATE - 3)::text AS expected`,
    );
    const candidate = (await service.findShirtCandidates()).find((c) => c.id === person);

    expect(candidate?.lastAttendedDate).toBe(expected);
  });

  it('sense cap assistència, la darrera data és null', async () => {
    const person = await insertPerson('maivingut');

    const candidate = (await service.findShirtCandidates()).find((c) => c.id === person);

    expect(candidate?.lastAttendedDate).toBeNull();
  });

  it('ignora els esdeveniments que no compten per a estadístiques', async () => {
    const extra = await insertEvent('ACTUACIO', false);
    const person = await insertPerson('noestad');
    await attend(person, [extra]);

    const candidates = await service.findShirtCandidates();

    expect(candidates.find((c) => c.id === person)?.performancesAttended).toBe(0);
  });

  it('exclou qui ja té camisa, les persones inactives i les provisionals', async () => {
    const ambCamisa = await insertPerson('ambcamisa', { shirtDate: '2024-01-15' });
    const inactiva = await insertPerson('inactiva', { isActive: false });
    const provisional = await insertPerson('~provisional', { isProvisional: true });
    const senseRes = await insertPerson('senseres');

    const ids = (await service.findShirtCandidates()).map((c) => c.id);

    expect(ids).not.toContain(ambCamisa);
    expect(ids).not.toContain(inactiva);
    expect(ids).not.toContain(provisional);
    // Sense cap assistència també hi apareix, al final.
    expect(ids).toContain(senseRes);
    expect(ids[ids.length - 1]).toBe(senseRes);
  });
});
