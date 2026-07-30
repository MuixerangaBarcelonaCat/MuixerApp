import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AttendanceStatus, EventType, FigureZone, NodeShape } from '@muixer/shared';
import { EventParticipationService } from './event-participation.service';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { Person } from '../person/person.entity';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import { Tag } from '../tag/tag.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for the participation overview. Three things a mocked
 * `DataSource.query` structurally cannot prove:
 *
 * 1. **The SQL parses and the casts work.** `= ANY($2::uuid[])` with an EMPTY array,
 *    `COUNT(*) FILTER (WHERE ...)`, `array_agg(...) FILTER (...)` and the
 *    `status::text = ANY($3::text[])` enum-name-independent comparison either work or
 *    throw at the Postgres level. A mock returns whatever you tell it.
 * 2. **The mapper is plural-safe against the real schema.** A person's tags must not be
 *    multiplied by their placement count — that is a property of the real join, not of
 *    hand-written fixture rows.
 * 3. **The query count stays constant.** The regression guard against someone
 *    refactoring the CTE into a per-segment loop.
 */
describe('EventParticipationService (integration)', () => {
  let db: IntegrationDb;
  let service: EventParticipationService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventParticipationService,
        ...realRepositoryProviders(db.dataSource, [Event]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();

    service = module.get(EventParticipationService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const shortId = () => Math.random().toString(36).slice(2, 10);

  async function makePerson(alias: string, overrides: Partial<Person> = {}) {
    return db.dataSource.getRepository(Person).save({
      name: 'Nom',
      firstSurname: 'Cognom',
      alias,
      ...overrides,
    } as Person);
  }

  async function makeSnapshottedInstance(
    segment: EventSegment,
    opts: { label?: string | null; withTemplate?: boolean; nodeLabels: string[] },
  ) {
    const template = opts.withTemplate
      ? await db.dataSource.getRepository(FigureTemplate).save({
          name: `4d7-${shortId()}`,
          slug: `tpl-${shortId()}`,
          direction: 0,
        } as FigureTemplate)
      : null;

    const instance = await db.dataSource.getRepository(FigureInstance).save({
      segment,
      figureTemplate: template,
      label: opts.label ?? null,
      sortOrder: 0,
      snapshotted: true,
    } as unknown as FigureInstance);

    const nodes: InstanceNode[] = [];
    for (const [i, label] of opts.nodeLabels.entries()) {
      nodes.push(
        await db.dataSource.getRepository(InstanceNode).save({
          figureInstance: instance,
          label,
          zone: FigureZone.PINYA,
          x: i,
          y: 0,
          width: 1,
          height: 1,
          shape: NodeShape.ELLIPSE,
          z: 0,
          renglaPosition: 2,
        } as unknown as InstanceNode),
      );
    }

    return { instance, nodes, template };
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
    return db.dataSource.getRepository(Attendance).save({
      event,
      person,
      status,
    } as unknown as Attendance);
  }

  /**
   * 1 event, 3 segments (the third hidden), a snapshotted and a non-snapshotted
   * instance, and 5 persons covering every branch of the population rule.
   */
  async function seedFullScenario() {
    const event = await db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Assaig complet',
      date: new Date('2026-05-01'),
    } as unknown as Event);

    const segRepo = db.dataSource.getRepository(EventSegment);
    const segA = await segRepo.save({ event, sortOrder: 0, name: 'Primera ronda' } as unknown as EventSegment);
    const segB = await segRepo.save({ event, sortOrder: 1, name: null } as unknown as EventSegment);
    const segHidden = await segRepo.save({
      event,
      sortOrder: 2,
      name: 'Amagat',
      isVisible: false,
    } as unknown as EventSegment);

    // Extra free nodes exist so every person gets its own: node-level uniqueness
    // (`UQ_node_assignments_instance_node`) stays in place and is NOT what we test here.
    const figA = await makeSnapshottedInstance(segA, {
      withTemplate: true,
      nodeLabels: ['Mans', 'Vent', 'Agulla', 'Lateral'],
    });
    const figB = await makeSnapshottedInstance(segB, {
      label: '3d7 de la plaça',
      withTemplate: true,
      nodeLabels: ['Baix', 'Contrafort'],
    });
    const figHidden = await makeSnapshottedInstance(segHidden, { withTemplate: true, nodeLabels: ['Lateral'] });

    // A non-snapshotted instance in segment A: contributes no placements, and makes
    // figureCount > snapshottedFigureCount.
    await db.dataSource.getRepository(FigureInstance).save({
      segment: segA,
      figureTemplate: figA.template,
      sortOrder: 1,
      snapshotted: false,
    } as unknown as FigureInstance);

    // P1: attended, placed in A and B, has 2 tags.
    const p1 = await makePerson('PERSIANA');
    await setAttendance(event, p1, AttendanceStatus.ASSISTIT);
    await assign(figA.instance, figA.nodes[0], p1, segA);
    await assign(figB.instance, figB.nodes[0], p1, segB);

    const tagRepo = db.dataSource.getRepository(Tag);
    const tag1 = await tagRepo.save({ name: 'Baix', slug: `baix-${shortId()}` } as unknown as Tag);
    const tag2 = await tagRepo.save({ name: 'Crossa', slug: `crossa-${shortId()}` } as unknown as Tag);
    p1.positions = [tag1, tag2];
    await db.dataSource.getRepository(Person).save(p1);

    // P2: coming, nothing to do.
    const p2 = await makePerson('GRILLAT');
    await setAttendance(event, p2, AttendanceStatus.ANIRE);

    // P3: declined but still holds a placement — the operationally interesting row.
    const p3 = await makePerson('XURRO');
    await setAttendance(event, p3, AttendanceStatus.NO_VAIG);
    await assign(figA.instance, figA.nodes[1], p3, segA);

    // P4: never answered, placed in the hidden segment.
    const p4 = await makePerson('MARIETA');
    await assign(figHidden.instance, figHidden.nodes[0], p4, segHidden);

    // P5: soft-deleted, attended, placed on its own node.
    const p5 = await makePerson('BAIXET', { isActive: false });
    await setAttendance(event, p5, AttendanceStatus.ASSISTIT);
    await assign(figB.instance, figB.nodes[1], p5, segB);

    // Nobody: pending with no placement — must NOT appear.
    const p6 = await makePerson('INVISIBLE');
    await setAttendance(event, p6, AttendanceStatus.PENDENT);

    return { event, segA, segB, segHidden, figA, figB, p1, p2, p3, p4, p5, p6 };
  }

  it('applies the population rule: confirmed OR placed, never pending-and-unplaced', async () => {
    const { event, p6 } = await seedFullScenario();

    const result = await service.getEventParticipation(event.id);
    const aliases = result.persons.map((p) => p.alias);

    expect(aliases).toEqual(expect.arrayContaining(['PERSIANA', 'GRILLAT', 'XURRO', 'MARIETA', 'BAIXET']));
    expect(aliases).not.toContain(p6.alias);
    expect(result.persons).toHaveLength(5);
  });

  it('does not multiply tags by placement count (real-join duplication guard)', async () => {
    const { event } = await seedFullScenario();

    const result = await service.getEventParticipation(event.id);
    const p1 = result.persons.find((p) => p.alias === 'PERSIANA')!;

    expect(Object.keys(p1.placements)).toHaveLength(2);
    expect(p1.placementCount).toBe(2);
    // Two placements x two tags would yield 4 rows if `positions` were joined into Q2.
    expect(p1.positions).toHaveLength(2);
    expect(p1.positions.map((t) => t.name)).toEqual(['Baix', 'Crossa']);
  });

  it('keeps a declined person, a never-asked person and a soft-deleted one, all flagged as data', async () => {
    const { event } = await seedFullScenario();

    const { persons } = await service.getEventParticipation(event.id);
    const byAlias = new Map(persons.map((p) => [p.alias, p]));

    expect(byAlias.get('XURRO')!.attendanceStatus).toBe(AttendanceStatus.NO_VAIG);
    expect(byAlias.get('XURRO')!.placementCount).toBe(1);
    expect(byAlias.get('MARIETA')!.attendanceStatus).toBe(AttendanceStatus.PENDENT);
    expect(byAlias.get('BAIXET')!.isActive).toBe(false);
    expect(byAlias.get('GRILLAT')!.placements).toEqual({});
  });

  it('includes hidden segments and reports snapshotted vs total figure counts', async () => {
    const { event, segA, segHidden } = await seedFullScenario();

    const { segments } = await service.getEventParticipation(event.id);

    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.sortOrder)).toEqual([0, 1, 2]);

    const hidden = segments.find((s) => s.id === segHidden.id)!;
    expect(hidden.isVisible).toBe(false);

    // Segment A has 2 instances but only 1 snapshotted.
    const a = segments.find((s) => s.id === segA.id)!;
    expect(a.figureCount).toBe(2);
    expect(a.snapshottedFigureCount).toBe(1);
    expect(a.figureNames).toHaveLength(2);
  });

  it('resolves the figure name from the instance label over the template name', async () => {
    const { event, segB } = await seedFullScenario();

    const { persons } = await service.getEventParticipation(event.id);
    const p1 = persons.find((p) => p.alias === 'PERSIANA')!;

    expect(p1.placements[segB.id][0].figureName).toBe('3d7 de la plaça');
  });

  it('returns numbers, not raw SQL strings', async () => {
    const { event, segA } = await seedFullScenario();

    const { persons, segments } = await service.getEventParticipation(event.id);
    const p1 = persons.find((p) => p.alias === 'PERSIANA')!;
    const placement = p1.placements[segA.id][0];

    expect(typeof placement.z).toBe('number');
    expect(typeof placement.renglaPosition).toBe('number');
    expect(typeof segments[0].figureCount).toBe('number');
    expect(typeof segments[0].sortOrder).toBe('number');
  });

  it('reports no conflicts while the uniqueness constraint is still in place', async () => {
    const { event } = await seedFullScenario();

    const { persons, meta } = await service.getEventParticipation(event.id);

    expect(meta.conflictedPersons).toBe(0);
    // P1 is placed in two DIFFERENT segments — legal, not a conflict.
    expect(persons.find((p) => p.alias === 'PERSIANA')!.conflictSegmentIds).toEqual([]);
  });

  /**
   * Proves the plural contract against real SQL. The unique constraint is dropped for
   * the duration of the test, which is exactly what the segments-flexibility migration
   * will do permanently — so this is also a preview of that regime.
   */
  it('surfaces a real duplicate as a conflict once the constraint is dropped', async () => {
    const { event, segA, figA, p2 } = await seedFullScenario();

    await db.dataSource.query(
      `ALTER TABLE node_assignments DROP CONSTRAINT IF EXISTS "UQ_node_assignments_segment_person"`,
    );
    await db.dataSource.query(
      `ALTER TABLE node_assignments DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_person"`,
    );

    // P2 takes two DIFFERENT free nodes of the same figure: physically impossible for
    // one person, and exactly what must be flagged. Both nodes are unoccupied, so the
    // node-level constraint (which stays) is not involved.
    await assign(figA.instance, figA.nodes[2], p2, segA);
    await assign(figA.instance, figA.nodes[3], p2, segA);

    const { persons, meta } = await service.getEventParticipation(event.id);
    const p2Row = persons.find((p) => p.alias === 'GRILLAT')!;

    expect(p2Row.placements[segA.id].length).toBeGreaterThan(1);
    expect(p2Row.conflictSegmentIds).toEqual([segA.id]);
    expect(p2Row.placementCount).toBeGreaterThan(p2Row.assignedSegmentCount);
    expect(meta.conflictedPersons).toBe(1);
  });

  it('survives an event with no segments (the empty-uuid-array cast)', async () => {
    const event = await db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Sense segments',
      date: new Date('2026-06-01'),
    } as unknown as Event);
    const person = await makePerson('SOLET');
    await setAttendance(event, person, AttendanceStatus.ANIRE);

    const result = await service.getEventParticipation(event.id);

    expect(result.segments).toEqual([]);
    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].placements).toEqual({});
  });

  it('runs a constant number of queries regardless of segment count (N+1 guard)', async () => {
    const { event } = await seedFullScenario();
    const spy = jest.spyOn(db.dataSource, 'query');

    await service.getEventParticipation(event.id);

    // Segments + matrix + tags. The event lookup goes through the repository.
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it('skips the tag query when the event has no participants', async () => {
    const event = await db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Buit',
      date: new Date('2026-06-02'),
    } as unknown as Event);
    const spy = jest.spyOn(db.dataSource, 'query');

    const result = await service.getEventParticipation(event.id);

    expect(result.persons).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
