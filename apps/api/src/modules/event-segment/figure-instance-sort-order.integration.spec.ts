import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventType } from '@muixer/shared';
import { FigureInstanceService } from './figure-instance.service';
import { EventSegmentService } from './event-segment.service';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { InstanceNode } from './entities/instance-node.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { Composition } from '../composition/entities/composition.entity';
import { Event } from '../event/event.entity';
import { NodeAssignmentService } from '../node-assignment/node-assignment.service';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

const EMPTY_SEGMENT_CONFLICTS = {
  data: [],
  meta: {
    assignmentCount: 0,
    distinctPersonCount: 0,
    tronc: { distinctPersonCount: 0 },
    pinya: { distinctPersonCount: 0 },
    conflictPersonCount: 0,
    conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
  },
};

/**
 * A segment's figures always hold `sortOrder` 0..n-1, unique (enforced by
 * `UQ_figure_instances_segment_sort_order`) and gap-free — the order, the «Pilar 1/2» numbering
 * and the figure color all derive from it. Concurrency can only be observed against real
 * Postgres: parallel appends used to read the same `MAX(sortOrder)`.
 */
describe('FigureInstanceService sortOrder (integration)', () => {
  let db: IntegrationDb;
  let service: FigureInstanceService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FigureInstanceService,
        EventSegmentService,
        ...realRepositoryProviders(db.dataSource, [
          FigureInstance,
          InstanceNode,
          EventSegment,
          FigureTemplate,
          Composition,
          Event,
        ]),
        {
          provide: NodeAssignmentService,
          useValue: {
            checkEventLock: jest.fn().mockResolvedValue(undefined),
            checkEventLockByEventId: jest.fn().mockResolvedValue(undefined),
            getSegmentMoveConflicts: jest.fn().mockResolvedValue([]),
            getByInstance: jest.fn().mockResolvedValue([]),
            getSegmentConflicts: jest.fn().mockResolvedValue(EMPTY_SEGMENT_CONFLICTS),
            getSegmentConflictsBySegments: jest
              .fn()
              .mockImplementation((ids: string[]) =>
                Promise.resolve(new Map(ids.map((id) => [id, EMPTY_SEGMENT_CONFLICTS]))),
              ),
          },
        },
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();

    service = module.get(FigureInstanceService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  async function seed(segmentCount = 1) {
    const event = await db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Assaig',
      date: new Date('2026-01-01'),
    });
    const segments = await Promise.all(
      Array.from({ length: segmentCount }, (_, i) =>
        db.dataSource.getRepository(EventSegment).save({ event, sortOrder: i }),
      ),
    );
    const template = await db.dataSource
      .getRepository(FigureTemplate)
      .save({ name: 'Pilar', slug: 'pilar', direction: 0 });
    return { event, segments, template };
  }

  /** The segment's instance ids in `sortOrder`, paired with that sortOrder. */
  async function orderOf(segmentId: string): Promise<[string, number][]> {
    const rows = await db.dataSource.getRepository(FigureInstance).find({
      where: { segment: { id: segmentId } },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => [r.id, r.sortOrder]);
  }

  async function createSequentially(eventId: string, segmentId: string, templateId: string, count: number) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push((await service.create(eventId, segmentId, { figureTemplateId: templateId })).id);
    }
    return ids;
  }

  it('gives concurrent creates in the same segment distinct, contiguous sortOrders', async () => {
    const { event, segments, template } = await seed();

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        service.create(event.id, segments[0].id, { figureTemplateId: template.id }),
      ),
    );

    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
    expect((await orderOf(segments[0].id)).map(([, s]) => s)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('gives concurrent copies into the same segment distinct, contiguous sortOrders', async () => {
    const { event, segments, template } = await seed(2);
    const [source] = await createSequentially(event.id, segments[0].id, template.id, 1);

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => service.copy(event.id, segments[0].id, source, segments[1].id)),
    );

    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
    expect((await orderOf(segments[1].id)).map(([, s]) => s)).toEqual([0, 1, 2, 3]);
  });

  it('closes the gap left by a removed figure, keeping the others in order', async () => {
    const { event, segments, template } = await seed();
    const [a, b, c] = await createSequentially(event.id, segments[0].id, template.id, 3);

    await service.remove(event.id, segments[0].id, b);

    expect(await orderOf(segments[0].id)).toEqual([
      [a, 0],
      [c, 1],
    ]);
  });

  it('closes the gap in the source segment when a figure is moved out', async () => {
    const { event, segments, template } = await seed(2);
    const [a, b, c] = await createSequentially(event.id, segments[0].id, template.id, 3);
    const [d] = await createSequentially(event.id, segments[1].id, template.id, 1);

    await service.move(event.id, segments[0].id, a, segments[1].id, 0);

    expect(await orderOf(segments[0].id)).toEqual([
      [b, 0],
      [c, 1],
    ]);
    expect(await orderOf(segments[1].id)).toEqual([
      [a, 0],
      [d, 1],
    ]);
  });

  it('rejects a reorder that leaves out one of the segment\'s figures with a 400', async () => {
    const { event, segments, template } = await seed();
    const [a, b, c] = await createSequentially(event.id, segments[0].id, template.id, 3);

    await expect(service.reorder(event.id, segments[0].id, { instanceIds: [c, a] })).rejects.toThrow(
      BadRequestException,
    );
    expect(await orderOf(segments[0].id)).toEqual([
      [a, 0],
      [b, 1],
      [c, 2],
    ]);
  });

  it('applies a full reorder, swapping positions through transient duplicates', async () => {
    const { event, segments, template } = await seed();
    const [a, b, c] = await createSequentially(event.id, segments[0].id, template.id, 3);

    await service.reorder(event.id, segments[0].id, { instanceIds: [c, a, b] });

    expect(await orderOf(segments[0].id)).toEqual([
      [c, 0],
      [a, 1],
      [b, 2],
    ]);
  });
});
