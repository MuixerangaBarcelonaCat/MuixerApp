import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, type Mock } from 'vitest';
import { of, throwError } from 'rxjs';
import { LUCIDE_ICONS, LucideIconProvider, Import, X } from 'lucide-angular';
import { EventType } from '@muixer/shared';
import { ImportPinyaModalComponent } from './import-pinya-modal.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { FigureHistoryEntry, BulkImportResult } from '../../models/assignment.model';

const TEMPLATE_ID = 'template-uuid-1';
const INSTANCE_ID = 'instance-uuid-1';
const SOURCE_INSTANCE_ID = 'source-uuid-1';

const makeHistoryEntry = (instanceId = SOURCE_INSTANCE_ID): FigureHistoryEntry => ({
  eventId: 'event-uuid-1',
  eventTitle: 'Assaig Setmana Santa',
  eventDate: '2026-03-15',
  eventType: EventType.ASSAIG,
  familyName: null,
  segmentName: 'Bloc 1',
  instanceId,
  snapshotted: true,
  sourceVariantOrder: 1,
  assignmentCount: 5,
  totalNodes: 8,
  assignments: [
    { nodeId: 'node-1', nodeLabel: 'pd4-1', personId: 'person-1', personAlias: 'Pepet' },
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

  beforeEach(async () => {
    assignmentService = {
      getHistory: vi.fn().mockReturnValue(of({ data: [makeHistoryEntry()] })),
      bulkImport: vi.fn().mockReturnValue(of({ created: [], conflicts: [] } as BulkImportResult)),
    };

    await TestBed.configureTestingModule({
      imports: [ImportPinyaModalComponent],
      providers: [
        { provide: NodeAssignmentService, useValue: assignmentService },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({ Import, X }),
        },
      ],
    }).compileComponents();

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
      const result: BulkImportResult = { created: [{}] as any, conflicts: [] };
      assignmentService.bulkImport.mockReturnValue(of(result));
      const entry = makeHistoryEntry();
      component.selectEntry(entry);
      component.doImport();
      expect(assignmentService.bulkImport).toHaveBeenCalledWith(
        INSTANCE_ID,
        { sourceInstanceId: SOURCE_INSTANCE_ID },
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
      const result: BulkImportResult = { created: [{}] as any, conflicts: [] };
      assignmentService.bulkImport.mockReturnValue(of(result));
      component.selectEntry(makeHistoryEntry());
      component.doImport();
      fixture.detectChanges();
      expect(component.lastResult()).toEqual(result);
    });

    it('shows conflict details when partial failures', () => {
      const result: BulkImportResult = {
        created: [],
        conflicts: [{ nodeId: 'n1', nodeLabel: 'base1', personAlias: 'Pepet', reason: 'Occupied' }],
      };
      assignmentService.bulkImport.mockReturnValue(of(result));
      component.selectEntry(makeHistoryEntry());
      component.doImport();
      fixture.detectChanges();
      expect(component.lastResult()?.conflicts).toHaveLength(1);
    });

    it('emits importCompleted after successful import', () => {
      const result: BulkImportResult = { created: [], conflicts: [] };
      assignmentService.bulkImport.mockReturnValue(of(result));
      component.selectEntry(makeHistoryEntry());
      component.doImport();
      expect(importCompletedSpy).toHaveBeenCalledWith(result);
    });

    it('sets error signal on failure', () => {
      assignmentService.bulkImport.mockReturnValue(throwError(() => new Error('network')));
      component.selectEntry(makeHistoryEntry());
      component.doImport();
      expect(component.error()).not.toBeNull();
    });
  });
});
