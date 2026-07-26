import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventType, FigureZone, NodeShape } from '@muixer/shared';
import { NodeAssignmentService } from './node-assignment.service';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Person } from '../person/person.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { Event } from '../event/event.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres regression suite for BUG-17 (two concurrent first-assignments on the same
 * not-yet-snapshotted instance both saw `snapshotted: false` and both copied the template's nodes,
 * duplicating every InstanceNode). This is a genuine concurrency race between two real DB
 * connections/transactions — structurally invisible to mocked-repository unit tests, which only ever
 * have one fake "connection" and can't reproduce two overlapping snapshot transactions actually
 * racing on the same row. See TEST-2 in docs/automated-analyses/01-full-repo-audit.md.
 */
describe('NodeAssignmentService snapshot race (integration)', () => {
  let db: IntegrationDb;
  let service: NodeAssignmentService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodeAssignmentService,
        ...realRepositoryProviders(db.dataSource, [
          NodeAssignment,
          FigureInstance,
          InstanceNode,
          FigureNode,
          Person,
          FigureTemplate,
          EventSegment,
          Event,
        ]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();

    service = module.get(NodeAssignmentService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  it('does not duplicate InstanceNodes when two first-assignments race on the same instance', async () => {
    const eventRepo = db.dataSource.getRepository(Event);
    const segmentRepo = db.dataSource.getRepository(EventSegment);
    const templateRepo = db.dataSource.getRepository(FigureTemplate);
    const nodeRepo = db.dataSource.getRepository(FigureNode);
    const instanceRepo = db.dataSource.getRepository(FigureInstance);
    const personRepo = db.dataSource.getRepository(Person);

    const event = await eventRepo.save({
      eventType: EventType.ASSAIG,
      title: 'Assaig futur',
      date: new Date('2099-01-01'), // never lock-expired
    });
    const segment = await segmentRepo.save({ event, sortOrder: 0 });
    const template = await templateRepo.save({ name: 'pd4-race', slug: 'pd4-race', direction: 0 });

    const nodeA = await nodeRepo.save({
      template,
      label: 'A',
      zone: FigureZone.PINYA,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      shape: NodeShape.CIRCLE,
    });
    const nodeB = await nodeRepo.save({
      template,
      label: 'B',
      zone: FigureZone.PINYA,
      x: 1,
      y: 0,
      width: 1,
      height: 1,
      shape: NodeShape.CIRCLE,
    });

    const instance = await instanceRepo.save({
      segment,
      figureTemplate: template,
      sortOrder: 0,
      snapshotted: false,
    });

    const personA = await personRepo.save({ name: 'Person', firstSurname: 'A', alias: 'personA' });
    const personB = await personRepo.save({ name: 'Person', firstSurname: 'B', alias: 'personB' });

    await Promise.all([
      service.assign(instance.id, { nodeId: nodeA.id, personId: personA.id }),
      service.assign(instance.id, { nodeId: nodeB.id, personId: personB.id }),
    ]);

    const instanceNodeRepo = db.dataSource.getRepository(InstanceNode);
    const snapshotRows = await instanceNodeRepo.find({
      where: { figureInstance: { id: instance.id } },
    });

    // Exactly one InstanceNode per template FigureNode — never doubled by a lost race.
    expect(snapshotRows).toHaveLength(2);
    expect(new Set(snapshotRows.map((n) => n.sourceNodeId)).size).toBe(2);

    const assignmentRepo = db.dataSource.getRepository(NodeAssignment);
    const assignments = await assignmentRepo.find({ where: { figureInstance: { id: instance.id } } });
    expect(assignments).toHaveLength(2);
  });
});
