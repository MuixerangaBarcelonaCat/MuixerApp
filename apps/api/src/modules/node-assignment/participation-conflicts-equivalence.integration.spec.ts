import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  AttendanceStatus,
  EventType,
  FigureZone,
  NodeShape,
  SegmentConflictKind,
  classifyPlacementKind,
} from '@muixer/shared';
import { EventParticipationService } from './event-participation.service';
import { NodeAssignmentService } from './node-assignment.service';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { Person } from '../person/person.entity';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * D13 / risk 9 — the mandatory equivalence guard.
 *
 * The participation overview keeps its own constant-3-query batch aggregation instead of
 * calling `getSegmentConflicts()` per segment (that would reintroduce the N+1 the batch
 * was built to avoid). This suite proves the two INDEPENDENT data pipelines — participation's
 * raw-SQL matrix vs the canonical engine's entity query — never diverge on what a segment's
 * conflicts are, nor on their kind. It seeds real duplicates of all three kinds (the unique
 * constraints are dropped for the test, a preview of the Fase 5 regime) and compares.
 *
 * If this ever fails, the matrix and the taller would disagree about the same segment — the
 * exact discrepancy D13 exists to forbid.
 */
describe('Participation ↔ getSegmentConflicts equivalence (integration)', () => {
  let db: IntegrationDb;
  let participation: EventParticipationService;
  let assignments: NodeAssignmentService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventParticipationService,
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

    participation = module.get(EventParticipationService);
    assignments = module.get(NodeAssignmentService);
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

  async function makeEvent() {
    return db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Assaig equivalència',
      date: new Date('2026-05-01'),
    } as unknown as Event);
  }

  async function makeSegment(event: Event, sortOrder: number) {
    return db.dataSource.getRepository(EventSegment).save({
      event,
      sortOrder,
      name: `Bloc ${sortOrder}`,
    } as unknown as EventSegment);
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

  async function setAttendance(event: Event, person: Person, status: AttendanceStatus) {
    return db.dataSource.getRepository(Attendance).save({ event, person, status } as unknown as Attendance);
  }

  async function dropDuplicateConstraints() {
    await db.dataSource.query(
      `ALTER TABLE node_assignments DROP CONSTRAINT IF EXISTS "UQ_node_assignments_segment_person"`,
    );
    await db.dataSource.query(
      `ALTER TABLE node_assignments DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_person"`,
    );
  }

  /**
   * One event, four segments exercising every kind plus the legal cross-segment case:
   * - segTT: one person on two tronc nodes            → TRONC_TRONC
   * - segTP: one person on a tronc + a pinya node      → TRONC_PINYA
   * - segPP: one person on two pinya nodes             → PINYA_PINYA
   * - segClean: a cross-segment duplicate that is NOT a conflict, plus a single placement
   */
  async function seedEveryKind() {
    await dropDuplicateConstraints();
    const event = await makeEvent();

    const segTT = await makeSegment(event, 0);
    const segTP = await makeSegment(event, 1);
    const segPP = await makeSegment(event, 2);
    const segClean = await makeSegment(event, 3);

    const figTT = await makeInstanceWithNodes(segTT, [FigureZone.TRONC, FigureZone.BASE, FigureZone.PINYA]);
    const figTP = await makeInstanceWithNodes(segTP, [FigureZone.TRONC, FigureZone.PINYA, FigureZone.PINYA]);
    const figPP = await makeInstanceWithNodes(segPP, [FigureZone.PINYA, FigureZone.PINYA, FigureZone.TRONC]);
    const figClean = await makeInstanceWithNodes(segClean, [FigureZone.PINYA, FigureZone.TRONC]);

    // TRONC_TRONC (BASE counts as tronc, D10).
    const pTT = await makePerson('TRONCUT');
    await setAttendance(event, pTT, AttendanceStatus.ANIRE);
    await assign(figTT.instance, figTT.nodes[0], pTT, segTT);
    await assign(figTT.instance, figTT.nodes[1], pTT, segTT);

    // TRONC_PINYA.
    const pTP = await makePerson('MIXTA');
    await setAttendance(event, pTP, AttendanceStatus.ANIRE);
    await assign(figTP.instance, figTP.nodes[0], pTP, segTP);
    await assign(figTP.instance, figTP.nodes[1], pTP, segTP);

    // PINYA_PINYA.
    const pPP = await makePerson('PINYERA');
    await setAttendance(event, pPP, AttendanceStatus.ANIRE);
    await assign(figPP.instance, figPP.nodes[0], pPP, segPP);
    await assign(figPP.instance, figPP.nodes[1], pPP, segPP);

    // Legal cross-segment duplicate: same person placed once in two DIFFERENT segments.
    const pCross = await makePerson('VIATGERA');
    await setAttendance(event, pCross, AttendanceStatus.ANIRE);
    await assign(figTT.instance, figTT.nodes[2], pCross, segTT);
    await assign(figClean.instance, figClean.nodes[0], pCross, segClean);

    // A clean single placement.
    const pSolo = await makePerson('SOLA');
    await setAttendance(event, pSolo, AttendanceStatus.ANIRE);
    await assign(figClean.instance, figClean.nodes[1], pSolo, segClean);

    return { event, segTT, segTP, segPP, segClean };
  }

  /** Per-segment map personId → kind, derived from the participation overview. */
  function participationKindsBySegment(
    persons: Awaited<ReturnType<EventParticipationService['getEventParticipation']>>['persons'],
    segmentId: string,
  ): Map<string, SegmentConflictKind> {
    const kinds = new Map<string, SegmentConflictKind>();
    for (const person of persons) {
      if (!person.conflictSegmentIds.includes(segmentId)) continue;
      const areas = person.placements[segmentId].map((p) => p.area);
      kinds.set(person.id, classifyPlacementKind(areas));
    }
    return kinds;
  }

  it('agrees segment-by-segment on which persons conflict and on the kind', async () => {
    const { event, segTT, segTP, segPP, segClean } = await seedEveryKind();

    const overview = await participation.getEventParticipation(event.id);

    for (const segment of [segTT, segTP, segPP, segClean]) {
      const fromParticipation = participationKindsBySegment(overview.persons, segment.id);

      const canonical = await assignments.getSegmentConflicts(segment.id);
      const fromEngine = new Map(canonical.data.map((c) => [c.personId, c.kind]));

      // Same set of conflicted persons, and the same kind for each — no divergence.
      expect(fromParticipation).toEqual(fromEngine);
    }
  });

  it('agrees on the event-wide conflictsByKind aggregate', async () => {
    const { event, segTT, segTP, segPP, segClean } = await seedEveryKind();

    const overview = await participation.getEventParticipation(event.id);

    // Rebuild the aggregate straight from the canonical engine and compare.
    const engineAggregate: Record<SegmentConflictKind, number> = {
      [SegmentConflictKind.TRONC_TRONC]: 0,
      [SegmentConflictKind.TRONC_PINYA]: 0,
      [SegmentConflictKind.PINYA_PINYA]: 0,
    };
    for (const segment of [segTT, segTP, segPP, segClean]) {
      const canonical = await assignments.getSegmentConflicts(segment.id);
      for (const conflict of canonical.data) engineAggregate[conflict.kind] += 1;
    }

    expect(overview.meta.conflictsByKind).toEqual(engineAggregate);
    expect(engineAggregate).toEqual({
      [SegmentConflictKind.TRONC_TRONC]: 1,
      [SegmentConflictKind.TRONC_PINYA]: 1,
      [SegmentConflictKind.PINYA_PINYA]: 1,
    });
  });
});
