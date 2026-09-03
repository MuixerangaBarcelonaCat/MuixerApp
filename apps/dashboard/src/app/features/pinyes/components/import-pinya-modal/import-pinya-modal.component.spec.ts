import { FigureHistoryEntry, BulkImportResult } from '@muixer/pinyes-render';
import { FigureZone, ImportScope } from '@muixer/shared';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, type Mock } from 'vitest';
import { of, throwError } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { ImportPinyaModalComponent } from './import-pinya-modal.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';

const TEMPLATE_ID = 'template-uuid-1';
const INSTANCE_ID = 'instance-uuid-1';
const SOURCE_INSTANCE_ID = 'source-uuid-1';

const makeHistoryEntry = (instanceId = SOURCE_INSTANCE_ID): FigureHistoryEntry => ({
  eventId: 'event-uuid-1',
  eventTitle: 'Assaig Setmana Santa',
  eventDate: '2026-03-15',
  eventType: 'REHEARSAL',
  segmentId: 'segment-uuid-1',
  segmentName: 'Bloc 1',
  instanceId,
  snapshotted: true,
  assignmentCount: 5,
  totalNodes: 8,
  assignments: [
    { nodeId: 'node-1', nodeLabel: 'pd4-1', zone: FigureZone.PINYA, personId: 'person-1', personAlias: 'Pepet' },
  ],
});

describe('ImportPinyaModalComponent', () => {
  let fixture: ComponentFixture<ImportPinyaModalComponent>;
  let component: ImportPinyaModalComponent;
  let assignmentService: {
    getHistory: ReturnType<typeof vi.fn>;
    bulkImport: ReturnType<typeof vi.fn>;
  };
  let importCompletedSpy: Mock;
  let closedSpy: Mock;
  let state: AssignmentStateService;

  beforeEach(async () => {
    assignmentService = {
      getHistory: vi.fn().mockReturnValue(of({ data: [makeHistoryEntry()] })),
      bulkImport: vi.fn().mockReturnValue(of({ created: [], conflicts: [], clonedAdHocNodes: 0, conflictsByKind: {} } as unknown as BulkImportResult)),
    };

    await TestBed.configureTestingModule({
      imports: [ImportPinyaModalComponent],
      providers: [
        { provide: NodeAssignmentService, useValue: assignmentService },
        AssignmentStateService,
        allLucideIconsProvider,
      ],
    }).compileComponents();

    state = TestBed.inject(AssignmentStateService);

    fixture = TestBed.createComponent(ImportPinyaModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('figureTemplateId', TEMPLATE_ID);
    fixture.componentRef.setInput('currentInstanceId', INSTANCE_ID);
    fixture.componentRef.setInput('open', false);

    importCompletedSpy = vi.fn();
    closedSpy = vi.fn();
    component.importCompleted.subscribe((r) => importCompletedSpy(r));
    component.closed.subscribe(() => closedSpy());

    fixture.detectChanges();
  });

  // ── initialization ─────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('creates successfully', () => {
      expect(component).toBeTruthy();
    });

    it('loads history on open (calls getHistory with templateId)', () => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      expect(assignmentService.getHistory).toHaveBeenCalledWith(TEMPLATE_ID);
    });

    it('displays event list ordered by date (most recent first)', () => {
      const entries = [
        makeHistoryEntry('inst-2'),
        makeHistoryEntry('inst-1'),
      ];
      assignmentService.getHistory.mockReturnValue(of({ data: entries }));
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      expect(component.history()).toHaveLength(2);
    });
  });

  // ── selection ──────────────────────────────────────────────────────────────

  describe('selection', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
    });

    it('selecting an entry updates selectedEntry signal', () => {
      const entry = makeHistoryEntry();
      component.selectEntry(entry);
      expect(component.selectedEntry()?.instanceId).toBe(SOURCE_INSTANCE_ID);
    });

    it('"Importar" button calls bulkImport with correct sourceInstanceId', () => {
      const result: BulkImportResult = { created: [{}] as any, conflicts: [], clonedAdHocNodes: 0, conflictsByKind: {} as any };
      assignmentService.bulkImport.mockReturnValue(of(result));
      const entry = makeHistoryEntry();
      component.selectEntry(entry);
      component.doImport(ImportScope.ALL);
      expect(assignmentService.bulkImport).toHaveBeenCalledWith(
        INSTANCE_ID,
        { sourceInstanceId: SOURCE_INSTANCE_ID, scope: ImportScope.ALL },
      );
    });
  });

  // ── results ────────────────────────────────────────────────────────────────

  describe('results', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
    });

    it('shows success result after import', () => {
      const result: BulkImportResult = { created: [{}] as any, conflicts: [], clonedAdHocNodes: 0, conflictsByKind: {} as any };
      assignmentService.bulkImport.mockReturnValue(of(result));
      component.selectEntry(makeHistoryEntry());
      component.doImport(ImportScope.ALL);
      fixture.detectChanges();
      expect(component.lastResult()).toEqual(result);
    });

    it('shows conflict details when partial failures', () => {
      const result: BulkImportResult = {
        created: [],
        conflicts: [{ nodeId: 'n1', nodeLabel: 'base1', personAlias: 'Pepet', reason: 'Occupied' }],
        clonedAdHocNodes: 0,
        conflictsByKind: {} as any,
      };
      assignmentService.bulkImport.mockReturnValue(of(result));
      component.selectEntry(makeHistoryEntry());
      component.doImport(ImportScope.ALL);
      fixture.detectChanges();
      expect(component.lastResult()?.conflicts).toHaveLength(1);
    });

    it('emits importCompleted after successful import', () => {
      const result: BulkImportResult = { created: [], conflicts: [], clonedAdHocNodes: 0, conflictsByKind: {} as any };
      assignmentService.bulkImport.mockReturnValue(of(result));
      component.selectEntry(makeHistoryEntry());
      component.doImport(ImportScope.ALL);
      expect(importCompletedSpy).toHaveBeenCalledWith(result);
    });

    it('sets error signal on failure', () => {
      assignmentService.bulkImport.mockReturnValue(throwError(() => new Error('network')));
      component.selectEntry(makeHistoryEntry());
      component.doImport(ImportScope.ALL);
      expect(component.error()).not.toBeNull();
    });
  });

  // ── scoped import ──────────────────────────────────────────────────────────

  describe('scope', () => {
    const entryWithMixedZones = (): FigureHistoryEntry => ({
      eventId: 'e1',
      eventTitle: 'Assaig',
      eventDate: '2026-05-01',
      eventType: 'REHEARSAL',
      segmentId: 'seg-1',
      segmentName: 'Bloc 1',
      instanceId: 'inst-1',
      snapshotted: true,
      assignmentCount: 3,
      totalNodes: 5,
      assignments: [
        { nodeId: 'n1', nodeLabel: 'Segones', zone: FigureZone.PINYA, personId: 'p1', personAlias: 'Guille' },
        { nodeId: 'n2', nodeLabel: 'Base 2', zone: FigureZone.BASE, personId: 'p2', personAlias: 'Amparo' },
        { nodeId: 'n3', nodeLabel: 'Tronc 1', zone: FigureZone.TRONC, personId: 'p3', personAlias: 'Marc' },
      ],
    });

    it('counts assignments per scope from the selected entry', () => {
      component.selectEntry(entryWithMixedZones());
      fixture.detectChanges();

      expect(component.countForScope(ImportScope.PINYA)).toBe(1);
      expect(component.countForScope(ImportScope.TRONC)).toBe(2); // BASE + TRONC
      expect(component.countForScope(ImportScope.ALL)).toBe(3);
    });

    it('calls bulkImport with the chosen scope', () => {
      component.selectEntry(entryWithMixedZones());
      assignmentService.bulkImport.mockReturnValue(
        of({ created: [], conflicts: [], clonedAdHocNodes: 0, conflictsByKind: {} }),
      );

      component.doImport(ImportScope.TRONC);

      expect(assignmentService.bulkImport).toHaveBeenCalledWith(
        component.currentInstanceId(),
        { sourceInstanceId: 'inst-1', scope: ImportScope.TRONC },
      );
    });

    it('opens the preview modal for the chosen scope', () => {
      component.selectEntry(entryWithMixedZones());

      component.openPreview(ImportScope.TRONC);

      expect(component.previewScope()).toBe(ImportScope.TRONC);
    });

    it('closes the preview modal', () => {
      component.selectEntry(entryWithMixedZones());
      component.openPreview(ImportScope.PINYA);

      component.closePreview();

      expect(component.previewScope()).toBeNull();
    });
  });

  // ── occupied-nodes confirmation ─────────────────────────────────────────────

  describe('occupied-nodes confirmation', () => {
    const entryWithMixedZones = (): FigureHistoryEntry => ({
      eventId: 'e1',
      eventTitle: 'Assaig',
      eventDate: '2026-05-01',
      eventType: 'REHEARSAL',
      segmentId: 'seg-1',
      segmentName: 'Bloc 1',
      instanceId: 'inst-1',
      snapshotted: true,
      assignmentCount: 3,
      totalNodes: 5,
      assignments: [
        { nodeId: 'n1', nodeLabel: 'Segones', zone: FigureZone.PINYA, personId: 'p1', personAlias: 'Guille' },
        { nodeId: 'n2', nodeLabel: 'Base 2', zone: FigureZone.BASE, personId: 'p2', personAlias: 'Amparo' },
        { nodeId: 'n3', nodeLabel: 'Tronc 1', zone: FigureZone.TRONC, personId: 'p3', personAlias: 'Marc' },
      ],
    });

    beforeEach(() => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      component.selectEntry(entryWithMixedZones());
    });

    it('counts destination nodes already occupied within the given scope', () => {
      state.assignments.set([
        { id: 'a1', figureInstanceId: INSTANCE_ID, node: { zone: FigureZone.PINYA } as any, person: {} as any },
        { id: 'a2', figureInstanceId: INSTANCE_ID, node: { zone: FigureZone.TRONC } as any, person: {} as any },
        { id: 'a3', figureInstanceId: 'other-instance', node: { zone: FigureZone.PINYA } as any, person: {} as any },
      ]);

      expect(component.occupiedCountForScope(ImportScope.PINYA)).toBe(1);
      expect(component.occupiedCountForScope(ImportScope.TRONC)).toBe(1);
      expect(component.occupiedCountForScope(ImportScope.ALL)).toBe(2);
    });

    it('imports directly when no destination node is occupied in scope', () => {
      state.assignments.set([]);

      component.onImportClick(ImportScope.PINYA);

      expect(assignmentService.bulkImport).toHaveBeenCalledWith(
        INSTANCE_ID,
        { sourceInstanceId: 'inst-1', scope: ImportScope.PINYA },
      );
      expect(component.confirmScope()).toBeNull();
    });

    it('opens a confirmation instead of importing when a destination node is occupied in scope', () => {
      state.assignments.set([
        { id: 'a1', figureInstanceId: INSTANCE_ID, node: { zone: FigureZone.PINYA } as any, person: {} as any },
      ]);

      component.onImportClick(ImportScope.PINYA);

      expect(component.confirmScope()).toBe(ImportScope.PINYA);
      expect(assignmentService.bulkImport).not.toHaveBeenCalled();
    });

    it('cancelling the confirmation does not import', () => {
      state.assignments.set([
        { id: 'a1', figureInstanceId: INSTANCE_ID, node: { zone: FigureZone.PINYA } as any, person: {} as any },
      ]);
      component.onImportClick(ImportScope.PINYA);

      component.cancelConfirm();

      expect(component.confirmScope()).toBeNull();
      expect(assignmentService.bulkImport).not.toHaveBeenCalled();
    });

    it('confirming proceeds with the import for the pending scope', () => {
      state.assignments.set([
        { id: 'a1', figureInstanceId: INSTANCE_ID, node: { zone: FigureZone.PINYA } as any, person: {} as any },
      ]);
      component.onImportClick(ImportScope.PINYA);

      component.confirmImport();

      expect(assignmentService.bulkImport).toHaveBeenCalledWith(
        INSTANCE_ID,
        { sourceInstanceId: 'inst-1', scope: ImportScope.PINYA },
      );
      expect(component.confirmScope()).toBeNull();
    });
  });
});
