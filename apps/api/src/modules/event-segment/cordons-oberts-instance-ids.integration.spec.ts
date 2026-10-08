import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventType, FigureZone, NodeShape } from '@muixer/shared';
import { EventSegmentService } from './event-segment.service';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { InstanceNode } from './entities/instance-node.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Event } from '../event/event.entity';
import { NodeAssignmentService } from '../node-assignment/node-assignment.service';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * `loadCordonsObertsInstanceIds` is raw SQL behind the segment list's cordons oberts toggle — the
 * unit spec mocks `dataSource.query`, so only real Postgres can catch a wrong column or quoting.
 * A snapshotted instance is judged by its own nodes (invariant 2), not its template's.
 */
describe('EventSegmentService.loadCordonsObertsInstanceIds (integration)', () => {
  let db: IntegrationDb;
  let service: EventSegmentService;
  let segment: EventSegment;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSegmentService,
        ...realRepositoryProviders(db.dataSource, [EventSegment, Event]),
        { provide: NodeAssignmentService, useValue: {} },
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();

    service = module.get(EventSegmentService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  beforeEach(async () => {
    const event = await db.dataSource
      .getRepository(Event)
      .save({ eventType: EventType.ASSAIG, title: 'Assaig', date: new Date('2026-01-01') });
    segment = await db.dataSource.getRepository(EventSegment).save({ event, sortOrder: 0 });
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const nodeFields = (i: number, positionType: string | null) => ({
    label: `N${i}`,
    zone: FigureZone.PINYA,
    positionType,
    x: 0,
    y: 0,
    z: 0,
    width: 30,
    height: 30,
    shape: NodeShape.ELLIPSE,
  });

  async function makeTemplate(slug: string, positionTypes: (string | null)[]): Promise<FigureTemplate> {
    const template = await db.dataSource
      .getRepository(FigureTemplate)
      .save({ name: slug, slug, direction: 0 } as FigureTemplate);
    for (const [i, positionType] of positionTypes.entries()) {
      await db.dataSource.getRepository(FigureNode).save({ template, ...nodeFields(i, positionType) } as unknown as FigureNode);
    }
    return template;
  }

  let nextSortOrder = 0;
  /** `snapshotNodes` set → a snapshotted instance holding exactly those nodes. */
  async function makeInstance(template: FigureTemplate, snapshotNodes?: (string | null)[]): Promise<FigureInstance> {
    const instance = await db.dataSource.getRepository(FigureInstance).save({
      segment,
      figureTemplate: template,
      sortOrder: nextSortOrder++,
      snapshotted: snapshotNodes !== undefined,
    } as unknown as FigureInstance);
    for (const [i, positionType] of (snapshotNodes ?? []).entries()) {
      await db.dataSource
        .getRepository(InstanceNode)
        .save({ figureInstance: instance, ...nodeFields(i, positionType) } as unknown as InstanceNode);
    }
    return instance;
  }

  it('before the snapshot, follows the template: only templates with a cordo-obert node', async () => {
    const withOberts = await makeInstance(await makeTemplate('amb-oberts', ['mans', 'cordo-obert']));
    const withoutOberts = await makeInstance(await makeTemplate('sense-oberts', ['mans', null]));

    const result = await service.loadCordonsObertsInstanceIds([withOberts.id, withoutOberts.id]);

    expect([...result]).toEqual([withOberts.id]);
  });

  it('after the snapshot, follows the instance nodes even when the template has changed since', async () => {
    const gainedOberts = await makeTemplate('ara-amb-oberts', ['mans', 'cordo-obert']);
    const lostOberts = await makeTemplate('ara-sense-oberts', ['mans']);
    const snapshotWithout = await makeInstance(gainedOberts, ['mans']);
    const snapshotWith = await makeInstance(lostOberts, ['mans', 'cordo-obert']);

    const result = await service.loadCordonsObertsInstanceIds([snapshotWithout.id, snapshotWith.id]);

    expect([...result]).toEqual([snapshotWith.id]);
  });

  it('ignores instances outside the requested ids', async () => {
    const template = await makeTemplate('amb-oberts', ['cordo-obert']);
    const requested = await makeInstance(await makeTemplate('demanada', ['mans']));
    await makeInstance(template);

    const result = await service.loadCordonsObertsInstanceIds([requested.id]);

    expect(result.size).toBe(0);
  });
});
