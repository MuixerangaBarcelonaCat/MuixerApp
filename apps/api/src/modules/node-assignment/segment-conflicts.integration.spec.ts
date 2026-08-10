import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventType, FigureZone, NodeShape, SegmentConflictKind } from '@muixer/shared';
import { NodeAssignmentService } from './node-assignment.service';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { Person } from '../person/person.entity';
import { Event } from '../event/event.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for `getSegmentConflicts()` (D13). The unit spec proves the
 * classification against fixture objects; this suite proves the SAME classification
 * against duplicates a mocked repository could never produce: the 3 uniqueness
 * constraints on `node_assignments` are dropped for the duration of each test — a
 * preview of the permanent regime the segments-flexibility migration will introduce —
 * so `assign()`-created rows are genuine duplicate placements, not hand-built fixtures.
 */
describe('NodeAssignmentService.getSegmentConflicts (integration)', () => {
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

  const shortId = () => Math.random().toString(36).slice(2, 10);

  async function makePerson(alias: string) {
    return db.dataSource.getRepository(Person).save({
      name: 'Nom',
      firstSurname: 'Cognom',
      alias,
    } as Person);
  }

  async function makeInstanceWithNodes(segment: EventSegment, zones: FigureZone[]) {
    const template = await db.dataSource.getRepository(FigureTemplate).save({
      name: `tpl-${shortId()}`,
      slug: `tpl-${shortId()}`,
      direction: 0,
    } as FigureTemplate);

    const instance = await db.dataSource.getRepository(FigureInstance).save({
      segment,
      figureTemplate: template,
      sortOrder: 0,
      snapshotted: true,
    } as unknown as FigureInstance);

    const nodes: InstanceNode[] = [];
    for (const [i, zone] of zones.entries()) {
      nodes.push(
        await db.dataSource.getRepository(InstanceNode).save({
          figureInstance: instance,
          label: `Node-${i}`,
          zone,
          x: i,
          y: 0,
          width: 1,
          height: 1,
          shape: NodeShape.ELLIPSE,
          z: 0,
          renglaPosition: zone === FigureZone.PINYA ? i + 1 : null,
        } as unknown as InstanceNode),
      );
    }

    return { instance, nodes };
  }

  async function assign(instance: FigureInstance, node: InstanceNode, person: Person, segment: EventSegment) {
    return db.dataSource.getRepository(NodeAssignment).save({
      figureInstance: instance,
      instanceNode: node,
      person,
      segment,
    } as unknown as NodeAssignment);
  }

  async function makeSegment() {
    const event = await db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Assaig',
      date: new Date('2026-05-01'),
    } as unknown as Event);
    return db.dataSource.getRepository(EventSegment).save({
      event,
      sortOrder: 0,
      name: 'Bloc 1',
    } as unknown as EventSegment);
  }

  async function dropDuplicateConstraints() {
    await db.dataSource.query(
      `ALTER TABLE node_assignments DROP CONSTRAINT IF EXISTS "UQ_node_assignments_segment_person"`,
    );
    await db.dataSource.query(
      `ALTER TABLE node_assignments DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_person"`,
    );
  }

  it('reports no conflicts while the uniqueness constraints are still in place', async () => {
    const segment = await makeSegment();
    const { instance, nodes } = await makeInstanceWithNodes(segment, [FigureZone.TRONC]);
    const person = await makePerson('PEPET');
    await assign(instance, nodes[0], person, segment);

    const result = await service.getSegmentConflicts(segment.id);

    expect(result.data).toEqual([]);
    expect(result.meta.conflictPersonCount).toBe(0);
  });

  it('classifies a real TRONC_PINYA duplicate once the constraints are dropped', async () => {
    await dropDuplicateConstraints();
    const segment = await makeSegment();
    const { instance, nodes } = await makeInstanceWithNodes(segment, [FigureZone.TRONC, FigureZone.PINYA]);
    const person = await makePerson('PEPET');
    await assign(instance, nodes[0], person, segment);
    await assign(instance, nodes[1], person, segment);

    const result = await service.getSegmentConflicts(segment.id);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].kind).toBe(SegmentConflictKind.TRONC_PINYA);
    expect(result.data[0].placements.map((p) => p.zone)).toEqual([FigureZone.TRONC, FigureZone.PINYA]);
    expect(result.data[0].suggestedRemovalAssignmentIds).toHaveLength(1);
    expect(result.meta.conflictPersonCount).toBe(1);
    expect(result.meta.conflictsByKind[SegmentConflictKind.TRONC_PINYA]).toBe(1);
  });

  it('classifies a real TRONC_TRONC duplicate (BASE counts as tronc, D10)', async () => {
    await dropDuplicateConstraints();
    const segment = await makeSegment();
    const { instance, nodes } = await makeInstanceWithNodes(segment, [FigureZone.TRONC, FigureZone.BASE]);
    const person = await makePerson('PEPET');
    await assign(instance, nodes[0], person, segment);
    await assign(instance, nodes[1], person, segment);

    const result = await service.getSegmentConflicts(segment.id);

    expect(result.data[0].kind).toBe(SegmentConflictKind.TRONC_TRONC);
    expect(result.data[0].suggestedRemovalAssignmentIds).toEqual([]);
  });

  it('classifies a real PINYA_PINYA duplicate, suggesting removal of every placement but the interior one', async () => {
    await dropDuplicateConstraints();
    const segment = await makeSegment();
    const { instance, nodes } = await makeInstanceWithNodes(segment, [FigureZone.PINYA, FigureZone.PINYA]);
    const person = await makePerson('PEPET');
    const interior = await assign(instance, nodes[0], person, segment); // renglaPosition 1
    await assign(instance, nodes[1], person, segment); // renglaPosition 2

    const result = await service.getSegmentConflicts(segment.id);

    expect(result.data[0].kind).toBe(SegmentConflictKind.PINYA_PINYA);
    expect(result.data[0].suggestedRemovalAssignmentIds).toEqual(
      expect.not.arrayContaining([interior.id]),
    );
    expect(result.data[0].suggestedRemovalAssignmentIds).toHaveLength(1);
  });

  it('reports the mixed case (2 tronc + 1 pinya) as TRONC_TRONC with the pinya suggested for removal', async () => {
    await dropDuplicateConstraints();
    const segment = await makeSegment();
    const { instance, nodes } = await makeInstanceWithNodes(segment, [
      FigureZone.TRONC,
      FigureZone.TRONC,
      FigureZone.PINYA,
    ]);
    const person = await makePerson('PEPET');
    await assign(instance, nodes[0], person, segment);
    await assign(instance, nodes[1], person, segment);
    const pinyaAssignment = await assign(instance, nodes[2], person, segment);

    const result = await service.getSegmentConflicts(segment.id);

    expect(result.data[0].kind).toBe(SegmentConflictKind.TRONC_TRONC);
    expect(result.data[0].suggestedRemovalAssignmentIds).toEqual([pinyaAssignment.id]);
    expect(result.data[0].placements.map((p) => p.zone)).toEqual([
      FigureZone.TRONC,
      FigureZone.TRONC,
      FigureZone.PINYA,
    ]);
  });

  it('does not treat the same person duplicated across two DIFFERENT segments as a conflict', async () => {
    await dropDuplicateConstraints();
    const segmentA = await makeSegment();
    const segmentB = await db.dataSource.getRepository(EventSegment).save({
      event: segmentA.event,
      sortOrder: 1,
      name: 'Bloc 2',
    } as unknown as EventSegment);
    const { instance: instanceA, nodes: nodesA } = await makeInstanceWithNodes(segmentA, [FigureZone.TRONC]);
    const { instance: instanceB, nodes: nodesB } = await makeInstanceWithNodes(segmentB, [FigureZone.PINYA]);
    const person = await makePerson('PEPET');
    await assign(instanceA, nodesA[0], person, segmentA);
    await assign(instanceB, nodesB[0], person, segmentB);

    const resultA = await service.getSegmentConflicts(segmentA.id);
    const resultB = await service.getSegmentConflicts(segmentB.id);

    expect(resultA.data).toEqual([]);
    expect(resultB.data).toEqual([]);
  });
});
