import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { EventType, FigureMode, FigureZone, NodeShape } from '@muixer/shared';
import { ENTITIES } from '../database/entities';
import { Event } from '../event/event.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { Person } from '../person/person.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
} from '../../test-integration/integration-db';
import { EventSummaryData } from './build-event-summary-data';
import { EventSummaryModule } from './event-summary.module';
import { TYPST_ASSETS_DIR, TypstPdfRenderer } from './typst-pdf.renderer';

/**
 * Real Postgres + real HTTP + real Typst. Proves what the unit specs mock away: the
 * `:id/summary.pdf` route matches under Express 5, the three data sources' SQL feeds the summary
 * (floors ordered base-first, directors joined), and the response is a PDF download.
 */
describe('GET /api/events/:id/summary.pdf (integration)', () => {
  let db: IntegrationDb;
  let app: INestApplication;
  let baseUrl: string;
  let compileSpy: jest.SpyInstance;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        EventEmitterModule.forRoot(),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: db.container.getConnectionUri(),
          entities: ENTITIES,
          synchronize: false,
        }),
        EventSummaryModule,
      ],
    })
      // Under ts-jest `__dirname` is the source folder, not `dist`: point at the source assets.
      .overrideProvider(TYPST_ASSETS_DIR)
      .useValue(join(__dirname, '../../assets/typst'))
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;

    compileSpy = jest.spyOn(moduleRef.get(TypstPdfRenderer), 'compile');
  });

  afterAll(async () => {
    await app?.close();
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    compileSpy.mockClear();
    await truncateAllTables(db.dataSource);
  });

  const shortId = () => Math.random().toString(36).slice(2, 10);

  async function seedEvent() {
    const repo = <T>(entity: new () => T) => db.dataSource.getRepository(entity);

    const event = await repo(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Assaig general — Col·la',
      date: '2026-10-12',
      startTime: '19:30',
      notes: '## Escalfament\n\nHui **pinya**.',
    } as unknown as Event);
    const segment = await repo(EventSegment).save({ event, sortOrder: 0, name: null } as unknown as EventSegment);
    const template = await repo(FigureTemplate).save({
      name: 'Pd4',
      slug: `pd4-${shortId()}`,
      direction: 0,
    } as FigureTemplate);
    const instance = await repo(FigureInstance).save({
      segment,
      figureTemplate: template,
      figureMode: FigureMode.COMPLETA,
      sortOrder: 0,
      snapshotted: true,
    } as unknown as FigureInstance);

    const node = (label: string, zone: FigureZone, z: number, positionType: string | null = null) =>
      repo(InstanceNode).save({
        figureInstance: instance,
        label,
        zone,
        positionType,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        shape: NodeShape.RECTANGLE,
        z,
      } as unknown as InstanceNode);
    const person = (alias: string) =>
      repo(Person).save({ name: 'Nom', firstSurname: 'Cognom', alias } as Person);
    const assign = async (n: InstanceNode, alias: string) =>
      repo(NodeAssignment).save({
        figureInstance: instance,
        instanceNode: n,
        person: await person(alias),
        segment,
      } as unknown as NodeAssignment);

    // Saved top floor first, to prove the order comes from the data, not insertion.
    await assign(await node('T1', FigureZone.TRONC, 1), 'Joan');
    await assign(await node('B1', FigureZone.BASE, 0), 'Pepa');
    await node('B2', FigureZone.BASE, 0);
    await assign(await node('D1', FigureZone.DIRECTION, 0, 'direccio-tronc'), 'Quim');

    return event;
  }

  it('downloads the summary as a PDF named after the event', async () => {
    const event = await seedEvent();

    const response = await fetch(`${baseUrl}/events/${event.id}/summary.pdf`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="2026-10-12-assaig-general-colla.pdf"',
    );
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('feeds the template with the event, notes, segments, tronc floors and directors from the database', async () => {
    const event = await seedEvent();

    await fetch(`${baseUrl}/events/${event.id}/summary.pdf`);

    const data = compileSpy.mock.calls[0][1] as EventSummaryData;
    expect(data.event).toEqual(
      expect.objectContaining({ title: 'Assaig general — Col·la', date: 'Dilluns, 12 d’octubre del 2026', startTime: '19:30' }),
    );
    expect(data.notes).toBe('## Escalfament\n\nHui **pinya**.');
    expect(data.segments).toEqual([
      { number: 1, title: 'Pd4', figures: [{ label: null, directions: 'Quim', tronc: ['Pepa - ?', 'Joan'] }] },
    ]);
  });

  it('answers 404 for an unknown event', async () => {
    const response = await fetch(`${baseUrl}/events/00000000-0000-4000-8000-000000000000/summary.pdf`);

    expect(response.status).toBe(404);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const response = await fetch(`${baseUrl}/events/not-a-uuid/summary.pdf`);

    expect(response.status).toBe(400);
  });
});
