import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventType, FigureZone, NodeShape } from '@muixer/shared';
import { FigureInstanceService } from './figure-instance.service';
import { EventSegmentService } from './event-segment.service';
import { NodeAssignmentService } from '../node-assignment/node-assignment.service';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { InstanceNode } from './entities/instance-node.entity';
import { EventSegment } from './entities/event-segment.entity';
import { Composition } from '../composition/entities/composition.entity';
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
 * The Distribució tab (segment-distribution endpoint) and Previsualitza/PWA (segment-projection
 * endpoint, via `NodeAssignmentService.getInstanceNodes`) both render the SAME `<app-tronc-view
 * mode="projection">` for the same figure instance — they must always be handed the SAME node
 * set, or their tronc panels render (and measure — see `TroncPanelMeasurerComponent`) at
 * different sizes. Previously `getDistribution()` always read the live FigureTemplate, which
 * for a snapshotted instance silently omits per-instance ad-hoc nodes (e.g. a "Direcció pinya"
 * row, added via the Troncs tab's "Afegir" button, never exists on the reusable template) —
 * exactly the kind of divergence this suite exists to forbid.
 */
describe('Distribució ↔ Previsualitza node-set equivalence (integration)', () => {
  let db: IntegrationDb;
  let figureInstances: FigureInstanceService;
  let assignments: NodeAssignmentService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FigureInstanceService,
        EventSegmentService,
        NodeAssignmentService,
        ...realRepositoryProviders(db.dataSource, [
          FigureInstance,
          InstanceNode,
          EventSegment,
          Composition,
          FigureNode,
          FigureTemplate,
          NodeAssignment,
          Person,
          Event,
        ]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();

    figureInstances = module.get(FigureInstanceService);
    assignments = module.get(NodeAssignmentService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  async function makeEvent() {
    return db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Assaig equivalència',
      date: new Date('2026-05-01'),
    } as unknown as Event);
  }

  async function makeSegment(event: Event) {
    return db.dataSource.getRepository(EventSegment).save({
      event,
      sortOrder: 0,
      name: 'Bloc 1',
    } as unknown as EventSegment);
  }

  it('returns the same node id/zone set as the projection endpoint for a snapshotted instance with an ad-hoc direction node', async () => {
    const event = await makeEvent();
    const segment = await makeSegment(event);
    const template = await db.dataSource.getRepository(FigureTemplate).save({
      name: 'pd4',
      slug: 'pd4',
      direction: 0,
    } as FigureTemplate);

    const instance = await db.dataSource.getRepository(FigureInstance).save({
      segment,
      figureTemplate: template,
      sortOrder: 0,
      snapshotted: true,
    } as unknown as FigureInstance);

    // A TRONC node "copied" from the template at snapshot time...
    await db.dataSource.getRepository(InstanceNode).save({
      figureInstance: instance,
      label: 'Segon',
      zone: FigureZone.TRONC,
      positionType: 'segon',
      x: 0,
      y: 0,
      z: 1,
      width: 2,
      height: 1,
      shape: NodeShape.RECTANGLE,
      sourceNodeId: template.id, // stands in for a real FigureNode id
      isAdHoc: false,
    } as unknown as InstanceNode);

    // ...and an ad-hoc "Direcció pinya" row, added per-instance — never exists on the template.
    await db.dataSource.getRepository(InstanceNode).save({
      figureInstance: instance,
      label: 'Direcció pinya',
      zone: FigureZone.DIRECTION,
      positionType: 'direccio-pinya',
      x: 0,
      y: 0,
      z: 0,
      width: 90,
      height: 44,
      shape: NodeShape.RECTANGLE,
      sourceNodeId: null,
      isAdHoc: true,
    } as unknown as InstanceNode);

    const distribution = await figureInstances.getDistribution(event.id, segment.id);
    const projectionNodes = await assignments.getInstanceNodes(instance.id);

    const distributionIds = distribution.items[0].figureTemplate.nodes.map((n) => n.id).sort();
    const projectionIds = projectionNodes.map((n) => n.id).sort();
    expect(distributionIds).toEqual(projectionIds);

    const distributionZones = distribution.items[0].figureTemplate.nodes.map((n) => n.zone).sort();
    const projectionZones = projectionNodes.map((n) => n.zone).sort();
    expect(distributionZones).toEqual(projectionZones);
    expect(distributionZones).toContain('DIRECTION');
  });

  it('returns the same node id set as the projection endpoint for a not-yet-snapshotted instance (both read the live template)', async () => {
    const event = await makeEvent();
    const segment = await makeSegment(event);
    const template = await db.dataSource.getRepository(FigureTemplate).save({
      name: 'pd4',
      slug: 'pd4-b',
      direction: 0,
    } as FigureTemplate);
    await db.dataSource.getRepository(FigureNode).save({
      template,
      label: 'A1',
      zone: FigureZone.PINYA,
      x: 0,
      y: 0,
      z: 0,
      width: 30,
      height: 30,
      shape: NodeShape.ELLIPSE,
    } as unknown as FigureNode);

    const instance = await db.dataSource.getRepository(FigureInstance).save({
      segment,
      figureTemplate: template,
      sortOrder: 0,
      snapshotted: false,
    } as unknown as FigureInstance);

    const distribution = await figureInstances.getDistribution(event.id, segment.id);
    const projectionNodes = await assignments.getInstanceNodes(instance.id);

    const distributionIds = distribution.items[0].figureTemplate.nodes.map((n) => n.id).sort();
    const projectionIds = projectionNodes.map((n) => n.id).sort();
    expect(distributionIds).toEqual(projectionIds);
    expect(distributionIds).toHaveLength(1);
  });
});
