import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventType } from '@muixer/shared';
import { FigureInstanceService } from './figure-instance.service';
import { EventSegmentService } from './event-segment.service';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
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

/**
 * Real-Postgres regression suite for BUG-11 (`applyComposition`'s `MAX(sortOrder)` was read through a
 * different connection than the enclosing transaction, so under READ COMMITTED it never saw the
 * transaction's own inserts and every entry landed on the same sortOrder). A mocked-repository unit
 * test cannot observe this — it doesn't have two real connections/snapshots to diverge in the first
 * place. See TEST-2 in docs/automated-analyses/01-full-repo-audit.md.
 */
describe('FigureInstanceService.applyComposition (integration)', () => {
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
          EventSegment,
          FigureTemplate,
          Composition,
          Event,
        ]),
        {
          provide: NodeAssignmentService,
          useValue: {
            checkEventLockByEventId: jest.fn().mockResolvedValue(undefined),
            getSegmentConflicts: jest.fn().mockResolvedValue({
              data: [],
              meta: {
                assignmentCount: 0,
                distinctPersonCount: 0,
                tronc: { distinctPersonCount: 0 },
                pinya: { distinctPersonCount: 0 },
                conflictPersonCount: 0,
                conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
              },
            }),
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

  it('assigns each composition entry a distinct, sequential sortOrder', async () => {
    const eventRepo = db.dataSource.getRepository(Event);
    const segmentRepo = db.dataSource.getRepository(EventSegment);
    const templateRepo = db.dataSource.getRepository(FigureTemplate);
    const compositionRepo = db.dataSource.getRepository(Composition);

    const event = await eventRepo.save({
      eventType: EventType.ASSAIG,
      title: 'Assaig',
      date: new Date('2026-01-01'),
    });
    const segment = await segmentRepo.save({ event, sortOrder: 0 });

    const templates = await Promise.all(
      ['pd4', 'pd5', 'torre'].map((name, i) =>
        templateRepo.save({ name, slug: `${name}-${i}`, direction: 0 }),
      ),
    );

    const composition = await compositionRepo.save({
      name: 'Composició de prova',
      entries: templates.map((figureTemplate, i) => ({
        figureTemplate,
        label: figureTemplate.name,
        sortOrder: i,
      })),
    });

    const result = await service.applyComposition(event.id, segment.id, composition.id);

    const sortOrders = result.instances.map((i) => i.sortOrder).sort((a, b) => a - b);
    expect(sortOrders).toEqual([0, 1, 2]);
    expect(new Set(sortOrders).size).toBe(3);
  });

  it('appends after existing instances instead of colliding with their sortOrder', async () => {
    const eventRepo = db.dataSource.getRepository(Event);
    const segmentRepo = db.dataSource.getRepository(EventSegment);
    const templateRepo = db.dataSource.getRepository(FigureTemplate);
    const compositionRepo = db.dataSource.getRepository(Composition);
    const instanceRepo = db.dataSource.getRepository(FigureInstance);

    const event = await eventRepo.save({
      eventType: EventType.ASSAIG,
      title: 'Assaig',
      date: new Date('2026-01-01'),
    });
    const segment = await segmentRepo.save({ event, sortOrder: 0 });
    const existingTemplate = await templateRepo.save({ name: 'existent', slug: 'existent', direction: 0 });
    await instanceRepo.save({ segment, figureTemplate: existingTemplate, sortOrder: 0 });

    const newTemplates = await Promise.all(
      ['a', 'b'].map((name) => templateRepo.save({ name, slug: name, direction: 0 })),
    );
    const composition = await compositionRepo.save({
      name: 'Composició 2',
      entries: newTemplates.map((figureTemplate, i) => ({
        figureTemplate,
        label: figureTemplate.name,
        sortOrder: i,
      })),
    });

    const result = await service.applyComposition(event.id, segment.id, composition.id);

    const sortOrders = result.instances.map((i) => i.sortOrder).sort((a, b) => a - b);
    expect(sortOrders).toEqual([0, 1, 2]);
  });
});
