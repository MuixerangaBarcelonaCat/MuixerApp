import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventType, FigureZone, NodeShape } from '@muixer/shared';
import { FigureTemplateService } from './figure-template.service';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { Rengla } from './entities/rengla.entity';
import { CreateFigureNodeDto } from './dto/create-figure-node.dto';
import { NodeAssignmentService } from '../node-assignment/node-assignment.service';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { Event } from '../event/event.entity';
import { Person } from '../person/person.entity';
import {
  IntegrationDb,
  realRepositoryProviders,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres round trip of `standsOnNodeIds` (uuid[]): the editor's client ids survive
 * repeated autosaves, a duplicate points its links at its own nodes, and the first assignment's
 * snapshot points the instance's links at the new InstanceNode ids.
 */
describe('FigureTemplate standsOnNodeIds (integration)', () => {
  let db: IntegrationDb;
  let templates: FigureTemplateService;
  let assignments: NodeAssignmentService;

  const B1 = randomUUID();
  const B2 = randomUUID();
  const S1 = randomUUID();

  const node = (id: string, zone: FigureZone, z: number, standsOnNodeIds: string[] = []): CreateFigureNodeDto => ({
    id,
    label: `${zone}-${id.slice(0, 4)}`,
    zone,
    positionType: zone === FigureZone.BASE ? 'base' : 'segona',
    x: 0,
    y: 0,
    z,
    width: 1,
    height: 40,
    shape: NodeShape.RECTANGLE,
    standsOnNodeIds,
  });

  const payload = () => [
    node(B1, FigureZone.BASE, 0),
    node(B2, FigureZone.BASE, 0),
    node(S1, FigureZone.TRONC, 1, [B1, B2]),
  ];

  beforeAll(async () => {
    db = await setupIntegrationDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FigureTemplateService,
        NodeAssignmentService,
        ...realRepositoryProviders(db.dataSource, [
          FigureTemplate,
          FigureNode,
          Rengla,
          FigureInstance,
          InstanceNode,
          NodeAssignment,
          Person,
          EventSegment,
          Event,
        ]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();
    templates = module.get(FigureTemplateService);
    assignments = module.get(NodeAssignmentService);
  }, 180_000);

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  it('keeps the client ids and links across create and repeated autosaves', async () => {
    const created = await templates.create({ name: 'Pilar de 4', nodes: payload() });
    await templates.update(created.id, { nodes: payload() });
    const saved = await templates.update(created.id, { nodes: payload() });

    expect(saved.nodes.map((n) => n.id).sort()).toEqual([B1, B2, S1].sort());
    expect(saved.nodes.find((n) => n.id === S1)?.standsOnNodeIds.sort()).toEqual([B1, B2].sort());
  });

  it('keeps the stored links when a save omits the field', async () => {
    const created = await templates.create({ name: 'Pilar de 4', nodes: payload() });

    const saved = await templates.update(created.id, {
      nodes: payload().map(({ standsOnNodeIds: _omitted, ...rest }) => rest),
    });

    expect(saved.nodes.find((n) => n.id === S1)?.standsOnNodeIds.sort()).toEqual([B1, B2].sort());
  });

  it('points the duplicate links at the copied nodes', async () => {
    const created = await templates.create({ name: 'Pilar de 4', nodes: payload() });

    const copy = await templates.duplicate(created.id);

    const copyBaseIds = copy.nodes.filter((n) => n.zone === FigureZone.BASE).map((n) => n.id);
    const copyTronc = copy.nodes.find((n) => n.zone === FigureZone.TRONC)!;
    expect(copyBaseIds).not.toContain(B1);
    expect(copyTronc.standsOnNodeIds.sort()).toEqual(copyBaseIds.sort());
  });

  it('points the duplicate nodes at its own copied rengles', async () => {
    const R1 = randomUUID();
    const created = await templates.create({
      name: 'Pilar de 4',
      nodes: [{ ...node(B1, FigureZone.BASE, 0), renglaId: R1, renglaPosition: 1 }],
    });
    await templates.update(created.id, { rengles: [{ id: R1, name: 'Mans Nord', sortOrder: 0 }] });

    const copy = await templates.duplicate(created.id);

    expect(copy.rengles).toHaveLength(1);
    expect(copy.rengles[0].id).not.toBe(R1);
    expect(copy.rengles[0].name).toBe('Mans Nord');
    expect(copy.nodes[0].renglaId).toBe(copy.rengles[0].id);
    const original = await templates.findOne(created.id);
    expect(original.rengles.map((r) => r.id)).toEqual([R1]);
  });

  it('points the snapshot links at the new instance nodes', async () => {
    const template = await templates.create({ name: 'Pilar de 4', nodes: payload() });
    const event = await db.dataSource
      .getRepository(Event)
      .save({ eventType: EventType.ASSAIG, title: 'Assaig', date: new Date('2099-01-01') });
    const segment = await db.dataSource.getRepository(EventSegment).save({ event, sortOrder: 0 });
    const instance = await db.dataSource.getRepository(FigureInstance).save({
      segment,
      figureTemplate: { id: template.id },
      sortOrder: 0,
      snapshotted: false,
    });
    const person = await db.dataSource
      .getRepository(Person)
      .save({ name: 'Persona', firstSurname: 'A', alias: 'personaA' });

    await assignments.assign(instance.id, { nodeId: S1, personId: person.id });

    const nodes = await assignments.getInstanceNodes(instance.id);
    const baseIds = nodes.filter((n) => n.zone === FigureZone.BASE).map((n) => n.id);
    const tronc = nodes.find((n) => n.sourceNodeId === S1)!;
    expect(baseIds).not.toContain(B1);
    expect(tronc.standsOnNodeIds.sort()).toEqual(baseIds.sort());
  });
});
