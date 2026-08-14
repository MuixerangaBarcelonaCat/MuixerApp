import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProjectionService } from './projection.service';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { Attendance } from '../event/attendance.entity';
import { NodeAssignmentService } from '../node-assignment/node-assignment.service';
import { AttendanceStatus, FigureMode } from '@muixer/shared';

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'seg-uuid-1';
const SEGMENT_2_ID = 'seg-uuid-2';

const makeSegment = (id: string, sortOrder: number): Partial<EventSegment> => ({
  id,
  sortOrder,
  name: null,
  event: { id: EVENT_ID } as EventSegment['event'],
});

const makeInstance = (): Partial<FigureInstance> => ({
  id: 'inst-uuid-1',
  label: null,
  sortOrder: 0,
  figureMode: FigureMode.COMPLETA,
  figureTemplate: null,
  numberOfCordons: null,
  projectionX: null,
  projectionY: null,
  projectionScale: 1,
});

const makeAttendance = (personId: string, status: AttendanceStatus): Partial<Attendance> => ({
  id: `att-${personId}`,
  status,
  person: { id: personId } as Attendance['person'],
});

const mockSegmentRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockInstanceRepo = {
  find: jest.fn(),
};

const mockAttendanceRepo = {
  find: jest.fn(),
};

const DEFAULT_CONFLICTS_META = {
  assignmentCount: 0,
  distinctPersonCount: 0,
  tronc: { distinctPersonCount: 0 },
  pinya: { distinctPersonCount: 0 },
  conflictPersonCount: 0,
  conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
};

const mockNodeAssignmentService = {
  getInstanceNodes: jest.fn().mockResolvedValue([]),
  getByInstance: jest.fn().mockResolvedValue([]),
  getSegmentConflicts: jest.fn().mockResolvedValue({ data: [], meta: DEFAULT_CONFLICTS_META }),
};

async function buildService(): Promise<ProjectionService> {
  const module = await Test.createTestingModule({
    providers: [
      ProjectionService,
      { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
      { provide: getRepositoryToken(FigureInstance), useValue: mockInstanceRepo },
      { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
      { provide: NodeAssignmentService, useValue: mockNodeAssignmentService },
    ],
  }).compile();

  return module.get(ProjectionService);
}

describe('ProjectionService', () => {
  let service: ProjectionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSegmentRepo.findOne.mockResolvedValue(makeSegment(SEGMENT_ID, 0));
    mockSegmentRepo.find.mockResolvedValue([
      makeSegment(SEGMENT_ID, 0),
      makeSegment(SEGMENT_2_ID, 1),
    ]);
    mockInstanceRepo.find.mockResolvedValue([]);
    mockAttendanceRepo.find.mockResolvedValue([]);
    service = await buildService();
  });

  // ── getProjection throws when segment not found ─────────────────────────

  it('throws NotFoundException when segment does not exist', async () => {
    mockSegmentRepo.findOne.mockResolvedValue(null);
    await expect(service.getProjection(EVENT_ID, SEGMENT_ID)).rejects.toThrow(NotFoundException);
  });

  // ── segment navigation ───────────────────────────────────────────────────

  it('returns prevSegmentId=null for first segment', async () => {
    mockSegmentRepo.findOne.mockResolvedValue(makeSegment(SEGMENT_ID, 0));
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.segment.prevSegmentId).toBeNull();
    expect(result.segment.nextSegmentId).toBe(SEGMENT_2_ID);
  });

  it('returns nextSegmentId=null for last segment', async () => {
    mockSegmentRepo.findOne.mockResolvedValue(makeSegment(SEGMENT_2_ID, 1));
    const result = await service.getProjection(EVENT_ID, SEGMENT_2_ID);
    expect(result.segment.prevSegmentId).toBe(SEGMENT_ID);
    expect(result.segment.nextSegmentId).toBeNull();
  });

  // ── personAttendance ─────────────────────────────────────────────────────

  it('returns empty personAttendance when no attendances exist', async () => {
    mockAttendanceRepo.find.mockResolvedValue([]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.personAttendance).toEqual({});
  });

  it('populates personAttendance from event attendances', async () => {
    mockAttendanceRepo.find.mockResolvedValue([
      makeAttendance('person-1', AttendanceStatus.ASSISTIT),
      makeAttendance('person-2', AttendanceStatus.ANIRE),
      makeAttendance('person-3', AttendanceStatus.NO_VAIG),
    ]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.personAttendance['person-1']).toBe(AttendanceStatus.ASSISTIT);
    expect(result.personAttendance['person-2']).toBe(AttendanceStatus.ANIRE);
    expect(result.personAttendance['person-3']).toBe(AttendanceStatus.NO_VAIG);
  });

  it('fetches attendances scoped to the event (not the segment)', async () => {
    await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(mockAttendanceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { event: { id: EVENT_ID } },
        relations: ['person'],
      }),
    );
  });

  it('last attendance wins when personId is duplicated', async () => {
    // Same person appears twice (edge case in data) — last write wins in the loop
    mockAttendanceRepo.find.mockResolvedValue([
      makeAttendance('person-1', AttendanceStatus.PENDENT),
      makeAttendance('person-1', AttendanceStatus.ASSISTIT),
    ]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.personAttendance['person-1']).toBe(AttendanceStatus.ASSISTIT);
  });

  // ── conflicts (D13 — last line of defense during assaig) ────────────────

  it('defaults conflicts to an empty array in production (no duplicates yet)', async () => {
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.conflicts).toEqual([]);
  });

  it('sources conflicts from getSegmentConflicts scoped to the projected segment', async () => {
    const conflict = {
      personId: 'person-1',
      personAlias: 'Pepet',
      placements: [],
      kind: 'TRONC_PINYA',
      suggestedRemovalAssignmentIds: [],
    };
    mockNodeAssignmentService.getSegmentConflicts.mockResolvedValue({
      data: [conflict],
      meta: DEFAULT_CONFLICTS_META,
    });

    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);

    expect(result.conflicts).toEqual([conflict]);
    expect(mockNodeAssignmentService.getSegmentConflicts).toHaveBeenCalledWith(SEGMENT_ID);
  });

  // ── instances array ───────────────────────────────────────────────────────

  it('returns empty instances array when no instances exist', async () => {
    mockInstanceRepo.find.mockResolvedValue([]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.instances).toHaveLength(0);
  });

  it('includes instance data with figureTemplate=null for composition instances', async () => {
    mockInstanceRepo.find.mockResolvedValue([makeInstance()]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.instances).toHaveLength(1);
    expect(result.instances[0].figureTemplate).toBeNull();
  });

  // ── hasDistribution ───────────────────────────────────────────────────────

  it('returns hasDistribution=false when no instances have projectionX set', async () => {
    mockInstanceRepo.find.mockResolvedValue([makeInstance()]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.hasDistribution).toBe(false);
  });

  it('returns hasDistribution=true when at least one instance has projectionX set', async () => {
    mockInstanceRepo.find.mockResolvedValue([
      { ...makeInstance(), projectionX: 100, projectionY: 200 },
    ]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.hasDistribution).toBe(true);
  });

  it('returns hasDistribution=false for empty segment', async () => {
    mockInstanceRepo.find.mockResolvedValue([]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    expect(result.hasDistribution).toBe(false);
  });

  // ── distribution fields in instances ─────────────────────────────────────

  it('includes projectionAngle and troncPanel fields in projection instances', async () => {
    mockInstanceRepo.find.mockResolvedValue([
      {
        ...makeInstance(),
        projectionX: 100,
        projectionY: 200,
        projectionAngle: 45,
        troncPanelX: 10,
        troncPanelY: 20,
        troncPanelWidth: 150,
        troncPanelHeight: 80,
      },
    ]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    const inst = result.instances[0];
    expect(inst.projectionAngle).toBe(45);
    expect(inst.troncPanelX).toBe(10);
    expect(inst.troncPanelY).toBe(20);
    expect(inst.troncPanelWidth).toBe(150);
    expect(inst.troncPanelHeight).toBe(80);
  });

  it('returns null distribution fields when not set', async () => {
    mockInstanceRepo.find.mockResolvedValue([makeInstance()]);
    const result = await service.getProjection(EVENT_ID, SEGMENT_ID);
    const inst = result.instances[0];
    expect(inst.projectionAngle).toBeNull();
    expect(inst.troncPanelX).toBeNull();
  });

  // ── onlyPublished (PWA path — members only ever see published segments) ──

  describe('onlyPublished', () => {
    it('does not scope the segment lookup to isPublished by default (Dashboard path)', async () => {
      await service.getProjection(EVENT_ID, SEGMENT_ID);
      expect(mockSegmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: SEGMENT_ID, event: { id: EVENT_ID } },
      });
    });

    it('does not scope the sibling lookup to isPublished by default (Dashboard path)', async () => {
      await service.getProjection(EVENT_ID, SEGMENT_ID);
      expect(mockSegmentRepo.find).toHaveBeenCalledWith({
        where: { event: { id: EVENT_ID } },
        order: { sortOrder: 'ASC' },
        select: ['id', 'sortOrder'],
      });
    });

    it('scopes the segment lookup to published segments when onlyPublished is true', async () => {
      await service.getProjection(EVENT_ID, SEGMENT_ID, { onlyPublished: true });
      expect(mockSegmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: SEGMENT_ID, event: { id: EVENT_ID }, isPublished: true },
      });
    });

    it('scopes the sibling lookup to published segments when onlyPublished is true', async () => {
      await service.getProjection(EVENT_ID, SEGMENT_ID, { onlyPublished: true });
      expect(mockSegmentRepo.find).toHaveBeenCalledWith({
        where: { event: { id: EVENT_ID }, isPublished: true },
        order: { sortOrder: 'ASC' },
        select: ['id', 'sortOrder'],
      });
    });

    it('throws NotFoundException when the segment lookup finds nothing under the isPublished scope', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getProjection(EVENT_ID, SEGMENT_ID, { onlyPublished: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
