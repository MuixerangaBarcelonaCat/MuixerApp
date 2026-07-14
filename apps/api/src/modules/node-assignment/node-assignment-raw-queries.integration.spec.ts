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
 * Real-Postgres regression suite for the multi-way-join/multi-query raw-SQL paths ARCH-8 flagged as
 * "query patterns that won't scale": `getHistory` and `getEventAssignmentSummary` both `leftJoinAndSelect`
 * two sibling one-to-many relations (assignments × instanceNodes) onto the same root entity in one
 * query, producing a cartesian product of joined rows before TypeORM re-hydrates them back into
 * entities/arrays. A mocked-repository unit test can't tell whether that re-hydration is actually
 * lossless (no duplicated/missing assignments) — only a real query against a real join can. `bulkImport`
 * similarly runs its ~10-queries-per-entry conflict-check/snapshot/insert sequence for real. See TEST-2
 * in docs/automated-analyses/01-full-repo-audit.md.
 */
describe('NodeAssignmentService raw multi-join queries (integration)', () => {
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

  function shortId(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  async function makeFigureWithNodesAndAssignments(nodeCount: number, assignedCount: number) {
    const eventRepo = db.dataSource.getRepository(Event);
    const segmentRepo = db.dataSource.getRepository(EventSegment);
    const templateRepo = db.dataSource.getRepository(FigureTemplate);
    const nodeRepo = db.dataSource.getRepository(FigureNode);
    const instanceRepo = db.dataSource.getRepository(FigureInstance);
    const personRepo = db.dataSource.getRepository(Person);

    const event = await eventRepo.save({
      eventType: EventType.ASSAIG,
      title: `Assaig ${Math.random()}`,
      date: new Date('2099-01-01'),
    });
    const segment = await segmentRepo.save({ event, sortOrder: 0 });
    const template = await templateRepo.save({
      name: `tpl-${Math.random()}`,
      slug: `tpl-${Math.random()}`,
      direction: 0,
    });

    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push(
        await nodeRepo.save({
          template,
          label: `n${i}`,
          zone: FigureZone.PINYA,
          x: i,
          y: 0,
          width: 1,
          height: 1,
          shape: NodeShape.CIRCLE,
        }),
      );
    }

    const instance = await instanceRepo.save({
      segment,
      figureTemplate: template,
      sortOrder: 0,
      snapshotted: false,
    });

    for (let i = 0; i < assignedCount; i++) {
      const person = await personRepo.save({ name: 'P', firstSurname: `${i}`, alias: shortId() });
      await service.assign(instance.id, { nodeId: nodes[i].id, personId: person.id });
    }

    return { event, segment, template, instance };
  }

  it('getHistory reports assignment and node counts unaffected by the join fanout', async () => {
    const { template, instance } = await makeFigureWithNodesAndAssignments(5, 3);

    const { data } = await service.getHistory(template.id);

    const entry = data.find((d) => d.instanceId === instance.id);
    expect(entry).toBeDefined();
    expect(entry!.totalNodes).toBe(5);
    expect(entry!.assignmentCount).toBe(3);
    expect(entry!.assignments).toHaveLength(3);
  });

  it('getEventAssignmentSummary reports pinya assigned/total unaffected by the join fanout', async () => {
    const { event, instance } = await makeFigureWithNodesAndAssignments(4, 2);

    const summary = await service.getEventAssignmentSummary(event.id);

    const figure = summary.segments[0].figures.find((f) => f.instanceId === instance.id);
    expect(figure).toBeDefined();
    expect(figure!.pinya.total).toBe(4);
    expect(figure!.pinya.assigned).toBe(2);
  });

  it('bulkImport copies assignments from a snapshotted source instance into a matching target instance', async () => {
    const { event, template, instance: sourceInstance } = await makeFigureWithNodesAndAssignments(3, 2);

    const instanceRepo = db.dataSource.getRepository(FigureInstance);
    const segmentRepo = db.dataSource.getRepository(EventSegment);
    const targetSegment = await segmentRepo.save({ event, sortOrder: 1 });
    const targetInstance = await instanceRepo.save({
      segment: targetSegment,
      figureTemplate: template,
      sortOrder: 0,
      snapshotted: false,
    });

    const result = await service.bulkImport(targetInstance.id, { sourceInstanceId: sourceInstance.id });

    expect(result.created).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);

    const assignmentRepo = db.dataSource.getRepository(NodeAssignment);
    const targetAssignments = await assignmentRepo.find({ where: { figureInstance: { id: targetInstance.id } } });
    expect(targetAssignments).toHaveLength(2);
  });
});
