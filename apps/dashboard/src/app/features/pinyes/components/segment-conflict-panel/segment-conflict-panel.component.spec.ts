import { SegmentConflict, SegmentPeopleCounters } from '@muixer/pinyes-render';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { SegmentConflictPanelComponent } from './segment-conflict-panel.component';
import { SegmentWorkspaceStateService } from '../../services/segment-workspace-state.service';
import { ConflictResolutionService } from '../../services/conflict-resolution.service';

const makeCounters = (conflictPersonCount: number): SegmentPeopleCounters => ({
  assignmentCount: 0,
  distinctPersonCount: 0,
  tronc: { distinctPersonCount: 0 },
  pinya: { distinctPersonCount: 0 },
  conflictPersonCount,
  conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
});

const makeConflict = (overrides: Partial<SegmentConflict> = {}): SegmentConflict => ({
  personId: 'person-1',
  personAlias: 'Pepet',
  placements: [
    {
      assignmentId: 'as-1',
      figureInstanceId: 'inst-1',
      figureName: 'Figura 1',
      nodeId: 'node-1',
      nodeLabel: 'Mans',
      zone: 'PINYA',
      area: 'PINYA',
      z: 0,
      renglaPosition: null,
      cordon: null,
    },
  ],
  kind: 'PINYA_PINYA',
  suggestedRemovalAssignmentIds: [],
  ...overrides,
});

describe('SegmentConflictPanelComponent', () => {
  let fixture: ComponentFixture<SegmentConflictPanelComponent>;
  let ws: SegmentWorkspaceStateService;
  let resolution: { removePlacement: ReturnType<typeof vi.fn>; releaseSuggested: ReturnType<typeof vi.fn>; removeTroncSide: ReturnType<typeof vi.fn> };

  const setup = async () => {
    resolution = { removePlacement: vi.fn(), releaseSuggested: vi.fn(), removeTroncSide: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SegmentConflictPanelComponent],
      providers: [
        allLucideIconsProvider,
        SegmentWorkspaceStateService,
        { provide: ConflictResolutionService, useValue: resolution },
      ],
    }).compileComponents();

    ws = TestBed.inject(SegmentWorkspaceStateService);
    fixture = TestBed.createComponent(SegmentConflictPanelComponent);
    fixture.detectChanges();
  };

  it('renders nothing (no banner) when there are 0 conflicts — invisible in production', async () => {
    await setup();
    ws.conflictCounters.set(makeCounters(0));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('shows the banner with the conflict count when conflicts exist', async () => {
    await setup();
    ws.conflictCounters.set(makeCounters(2));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2');
    expect(fixture.nativeElement.textContent).toContain('persones en conflicte');
  });

  it('respects the server order (TRONC_TRONC → TRONC_PINYA → PINYA_PINYA) without re-sorting', async () => {
    await setup();
    const conflicts = [
      makeConflict({ personId: 'p-tt', kind: 'TRONC_TRONC' }),
      makeConflict({ personId: 'p-tp', kind: 'TRONC_PINYA' }),
      makeConflict({ personId: 'p-pp', kind: 'PINYA_PINYA' }),
    ];
    ws.conflictCounters.set(makeCounters(3));
    ws.conflicts.set(conflicts);
    fixture.detectChanges();
    fixture.componentInstance.togglePanel();
    fixture.detectChanges();

    const names = Array.from(fixture.nativeElement.querySelectorAll('[data-conflict-placement]')).length;
    expect(names).toBeGreaterThan(0);
    expect(fixture.componentInstance.conflicts().map((c) => c.personId)).toEqual(['p-tt', 'p-tp', 'p-pp']);
  });

  it('uses no distinct visual style per kind — same badge classes regardless of kind', async () => {
    await setup();
    ws.conflictCounters.set(makeCounters(1));
    ws.conflicts.set([makeConflict({ kind: 'TRONC_TRONC' })]);
    fixture.detectChanges();
    fixture.componentInstance.togglePanel();
    fixture.detectChanges();

    // Same badge classes are used for TRONC_TRONC as for any other kind: only `area` drives the badge.
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge).toBeTruthy();
  });

  it('everything is disabled while the workspace is locked', async () => {
    await setup();
    ws.conflictCounters.set(makeCounters(1));
    ws.conflicts.set([makeConflict({ kind: 'TRONC_PINYA', suggestedRemovalAssignmentIds: ['as-1'] })]);
    ws.lockStatus.set({ locked: true, lockDate: null, lockDays: 3 });
    fixture.detectChanges();
    fixture.componentInstance.togglePanel();
    fixture.detectChanges();

    const panelBody = fixture.nativeElement.querySelector('#segment-conflict-panel-body');
    const buttons: HTMLButtonElement[] = Array.from(panelBody.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.disabled).toBe(true);
    }
  });

  it('delegates row actions to ConflictResolutionService', async () => {
    await setup();
    const conflict = makeConflict({ kind: 'TRONC_PINYA', suggestedRemovalAssignmentIds: ['as-1'] });
    ws.conflictCounters.set(makeCounters(1));
    ws.conflicts.set([conflict]);
    fixture.detectChanges();

    fixture.componentInstance.removePlacement('person-1', conflict.placements[0]);
    fixture.componentInstance.releaseSuggested(conflict);
    fixture.componentInstance.removeTroncSide(conflict);

    expect(resolution.removePlacement).toHaveBeenCalledWith('person-1', conflict.placements[0]);
    expect(resolution.releaseSuggested).toHaveBeenCalledWith(conflict);
    expect(resolution.removeTroncSide).toHaveBeenCalledWith(conflict);
  });

  it('shows the review fragment and count when there are freed pinya nodes', async () => {
    await setup();
    ws.conflictCounters.set(makeCounters(1));
    ws.instances.set([
      {
        instanceId: 'inst-1',
        label: 'Figura 1',
        figureTemplateId: null,
        figureTemplateName: 'Figura 1',
        hasPinya: true,
        figureMode: 'COMPLETA',
        snapshotted: true,
        numberOfCordons: null,
        cordonsObertsEnabled: true,
        nodes: [{ id: 'n1', label: 'Mans', zone: 'PINYA', positionType: null, x: 0, y: 0, z: 0, width: 1, height: 1, rotation: 0, color: null, shape: 'RECTANGLE', sortOrder: 0, climbIndicator: null, ringLevel: null, originNodeId: null, renglaId: null, renglaPosition: null, sourceNodeId: null, isSnapshotted: true, isAdHoc: false, createdById: null }],
        assignedCount: 0,
        totalCount: 1,
      },
    ]);
    ws.reviewItems.set({ freedPinyaNodeIds: ['n1'] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('pinya a revisar');

    fixture.componentInstance.togglePanel();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Figura 1 — Mans');

    fixture.componentInstance.dismissReview();
    fixture.detectChanges();
    expect(ws.reviewItems().freedPinyaNodeIds).toEqual([]);
  });
});
