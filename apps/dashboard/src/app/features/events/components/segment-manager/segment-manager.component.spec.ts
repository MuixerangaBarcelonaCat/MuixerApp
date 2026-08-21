import { SegmentDetail, InstanceDetail, EventAssignmentSummary, EventFigureSummary, SegmentPeopleCounters } from '@muixer/pinyes-render';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { SegmentManagerComponent } from './segment-manager.component';
import { EventSegmentService } from '../../../pinyes/services/event-segment.service';
import { FigureInstanceService } from '../../../pinyes/services/figure-instance.service';
import { CompositionService } from '../../../pinyes/services/composition.service';
import { NodeAssignmentService } from '../../../pinyes/services/node-assignment.service';
import { ToastService } from '@muixer/ui';

const EVENT_ID = 'event-uuid-1';

const makeDrop = <T>(previousIndex: number, currentIndex: number): CdkDragDrop<T[]> =>
  ({ previousIndex, currentIndex } as unknown as CdkDragDrop<T[]>);

const makeSameContainerDrop = (previousIndex: number, currentIndex: number): CdkDragDrop<SegmentDetail> =>
  ({ previousIndex, currentIndex } as unknown as CdkDragDrop<SegmentDetail>);

const makeCrossSegmentDrop = (
  source: SegmentDetail,
  target: SegmentDetail,
  instance: InstanceDetail,
  previousIndex: number,
  currentIndex: number,
): CdkDragDrop<SegmentDetail> =>
  ({
    previousIndex,
    currentIndex,
    item: { data: instance },
    container: { data: target },
    previousContainer: { data: source },
  } as unknown as CdkDragDrop<SegmentDetail>);

const makeSegment = (overrides: Partial<SegmentDetail> = {}): SegmentDetail => ({
  id: 'seg-uuid-1',
  name: 'Bloc A',
  sortOrder: 0,
  startTime: null,
  endTime: null,
  notes: null,
  isPublished: false,
  instances: [],
  ...overrides,
});

const makeInstance = (overrides: Partial<InstanceDetail> = {}): InstanceDetail => ({
  id: 'inst-uuid-1',
  label: null,
  sortOrder: 0,
  snapshotted: false,
  assignedCount: 0,
  pinyaAssignedCount: 0,
  totalCordons: null,
  numberOfCordons: null,
  cordonsObertsEnabled: true,
  projectionX: null,
  projectionY: null,
  projectionScale: 1,
  figureMode: 'COMPLETA' as const,
  figureTemplate: { id: 'fig-1', name: 'pd4', hasPinya: true },
  ...overrides,
});

const makeAreaCount = (assigned: number, total: number) => ({ assigned, total });

const makeFigureSummary = (overrides: Partial<EventFigureSummary> = {}): EventFigureSummary => ({
  instanceId: 'inst-uuid-1',
  figureName: 'pd4',
  snapshotted: true,
  pinya: makeAreaCount(0, 0),
  tronc: makeAreaCount(0, 0),
  total: makeAreaCount(0, 0),
  troncBaseAssignments: [],
  distinctPersonCount: 0,
  conflictAssignmentCount: 0,
  ...overrides,
});

const makeEmptyCounters = (): SegmentPeopleCounters => ({
  assignmentCount: 0,
  distinctPersonCount: 0,
  tronc: { distinctPersonCount: 0 },
  pinya: { distinctPersonCount: 0 },
  conflictPersonCount: 0,
  conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
});

describe('SegmentManagerComponent', () => {
  let fixture: ComponentFixture<SegmentManagerComponent>;
  let component: SegmentManagerComponent;
  let segmentService: Partial<EventSegmentService>;
  let instanceService: Partial<FigureInstanceService>;
  let compositionService: { applyToSegment: ReturnType<typeof vi.fn> };
  let nodeAssignmentService: { getEventAssignmentSummary: ReturnType<typeof vi.fn> };
  let toastService: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn>; url: string };

  beforeEach(async () => {
    localStorage.clear();
    segmentService = {
      getByEvent: vi.fn().mockReturnValue(of({ data: [] })),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
      getTroncView: vi.fn().mockReturnValue(of([])),
    };

    instanceService = {
      create: vi.fn(),
      remove: vi.fn(),
      update: vi.fn(),
      reorder: vi.fn().mockReturnValue(of(undefined)),
      copy: vi.fn(),
      move: vi.fn(),
    };

    compositionService = {
      applyToSegment: vi.fn(),
    };

    nodeAssignmentService = {
      getEventAssignmentSummary: vi.fn().mockReturnValue(of({ segments: [] } satisfies EventAssignmentSummary)),
    };

    toastService = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    };

    routerMock = { navigate: vi.fn(), url: '/rehearsals/event-123' };

    await TestBed.configureTestingModule({
      imports: [SegmentManagerComponent, DragDropModule],
      providers: [
        { provide: EventSegmentService, useValue: segmentService },
        { provide: FigureInstanceService, useValue: instanceService },
        { provide: CompositionService, useValue: compositionService },
        { provide: NodeAssignmentService, useValue: nodeAssignmentService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: routerMock },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SegmentManagerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('eventId', EVENT_ID);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('loads segments on init', () => {
    expect(segmentService.getByEvent).toHaveBeenCalledWith(EVENT_ID);
  });

  it('loads the event assignment summary on init', () => {
    expect(nodeAssignmentService.getEventAssignmentSummary).toHaveBeenCalledWith(EVENT_ID);
  });

  it('shows empty state when no segments', () => {
    expect(component.segments()).toHaveLength(0);
  });

  it('sets segments from service response', async () => {
    const seg = makeSegment();
    (segmentService.getByEvent as ReturnType<typeof vi.fn>).mockReturnValue(
      of({ data: [seg] })
    );
    component.ngOnInit();
    expect(component.segments()).toHaveLength(1);
    expect(component.segments()[0].id).toBe('seg-uuid-1');
  });

  describe('displayName()', () => {
    it('returns custom name when set', () => {
      const seg = makeSegment({ name: 'Bloc A' });
      expect(component.displayName()(seg)).toBe('Bloc A');
    });

    it('auto-generates from instances when name is null', () => {
      const seg = makeSegment({
        name: null,
        instances: [
          makeInstance({ id: 'i1', figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true } }),
          makeInstance({ id: 'i2', figureTemplate: { id: 'f2', name: 'Morera', hasPinya: true } }),
        ],
      });
      expect(component.displayName()(seg)).toBe('pd4 + Morera');
    });

    it('returns fallback when name is null and no instances', () => {
      const seg = makeSegment({ name: null, instances: [] });
      expect(component.displayName()(seg)).toBe('Segment sense nom');
    });
  });

  describe('createSegment()', () => {
    it('calls service and adds segment to list', () => {
      const seg = makeSegment();
      (segmentService.create as ReturnType<typeof vi.fn>).mockReturnValue(of(seg));
      component.createSegment();
      expect(segmentService.create).toHaveBeenCalledWith(EVENT_ID, {});
      expect(component.segments()).toHaveLength(1);
    });

    it('shows error toast on failure', () => {
      (segmentService.create as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => new Error()));
      component.createSegment();
      expect(toastService.error).toHaveBeenCalled();
    });
  });

  describe('toggleVisibility()', () => {
    it('calls update with inverted isPublished and updates the list', () => {
      const seg = makeSegment({ isPublished: false });
      const updated = { ...seg, isPublished: true };
      component.segments.set([seg]);
      (segmentService.update as ReturnType<typeof vi.fn>).mockReturnValue(of(updated));

      component.toggleVisibility(seg);

      expect(segmentService.update).toHaveBeenCalledWith(EVENT_ID, seg.id, { isPublished: true });
      expect(component.segments()[0].isPublished).toBe(true);
    });
  });

  describe('removeSegment()', () => {
    it('calls service and removes from list after confirm', () => {
      const seg = makeSegment();
      component.segments.set([seg]);
      (segmentService.remove as ReturnType<typeof vi.fn>).mockReturnValue(of(undefined));
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      component.removeSegment(seg);

      expect(segmentService.remove).toHaveBeenCalledWith(EVENT_ID, seg.id);
      expect(component.segments()).toHaveLength(0);
      expect(toastService.success).toHaveBeenCalled();
    });

    it('does NOT call service when user cancels confirm', () => {
      const seg = makeSegment();
      component.segments.set([seg]);
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      component.removeSegment(seg);

      expect(segmentService.remove).not.toHaveBeenCalled();
    });
  });

  describe('onSegmentDropped()', () => {
    it('reorders segments and calls service', () => {
      const seg0 = makeSegment({ id: 'seg-0', sortOrder: 0 });
      const seg1 = makeSegment({ id: 'seg-1', sortOrder: 1 });
      component.segments.set([seg0, seg1]);
      (segmentService.reorder as ReturnType<typeof vi.fn>).mockReturnValue(of(undefined));

      component.onSegmentDropped(makeDrop(1, 0));

      expect(component.segments()[0].id).toBe('seg-1');
      expect(component.segments()[1].id).toBe('seg-0');
      expect(segmentService.reorder).toHaveBeenCalledWith(EVENT_ID, ['seg-1', 'seg-0']);
    });

    it('does nothing when previousIndex equals currentIndex', () => {
      const seg = makeSegment({ id: 'seg-0', sortOrder: 0 });
      component.segments.set([seg]);

      component.onSegmentDropped(makeDrop(0, 0));

      expect(segmentService.reorder).not.toHaveBeenCalled();
    });
  });

  describe('onInstanceDropped()', () => {
    it('reorders instances and calls service', () => {
      const inst0 = makeInstance({ id: 'inst-0', sortOrder: 0 });
      const inst1 = makeInstance({ id: 'inst-1', sortOrder: 1 });
      const seg = makeSegment({ id: 'seg-1', instances: [inst0, inst1] });
      component.segments.set([seg]);

      component.onInstanceDropped(seg, makeSameContainerDrop(0, 1));

      const updatedInstances = component.segments()[0].instances;
      expect(updatedInstances[0].id).toBe('inst-1');
      expect(updatedInstances[1].id).toBe('inst-0');
      expect(instanceService.reorder).toHaveBeenCalledWith(EVENT_ID, 'seg-1', ['inst-1', 'inst-0']);
    });

    it('does nothing when previousIndex equals currentIndex', () => {
      const inst = makeInstance({ id: 'inst-0', sortOrder: 0 });
      const seg = makeSegment({ id: 'seg-1', instances: [inst] });
      component.segments.set([seg]);

      component.onInstanceDropped(seg, makeSameContainerDrop(0, 0));

      expect(instanceService.reorder).not.toHaveBeenCalled();
    });

    it('calls move service when dropped into a different segment', () => {
      const inst = makeInstance({ id: 'inst-1' });
      const source = makeSegment({ id: 'seg-1', instances: [inst] });
      const target = makeSegment({ id: 'seg-2', instances: [] });
      component.segments.set([source, target]);
      const moveResult = {
        sourceSegment: { ...source, instances: [] },
        targetSegment: { ...target, instances: [inst] },
      };
      (instanceService.move as ReturnType<typeof vi.fn>).mockReturnValue(of(moveResult));

      component.onInstanceDropped(target, makeCrossSegmentDrop(source, target, inst, 0, 0));

      expect(instanceService.move).toHaveBeenCalledWith(EVENT_ID, 'seg-1', 'inst-1', {
        targetSegmentId: 'seg-2',
        targetIndex: 0,
      });
    });

    it('replaces both source and target segments with the server response on success', () => {
      const inst = makeInstance({ id: 'inst-1' });
      const source = makeSegment({ id: 'seg-1', instances: [inst] });
      const target = makeSegment({ id: 'seg-2', instances: [] });
      component.segments.set([source, target]);
      const moveResult = {
        sourceSegment: { ...source, instances: [] },
        targetSegment: { ...target, instances: [inst] },
      };
      (instanceService.move as ReturnType<typeof vi.fn>).mockReturnValue(of(moveResult));

      component.onInstanceDropped(target, makeCrossSegmentDrop(source, target, inst, 0, 0));

      expect(component.segments().find((s) => s.id === 'seg-1')!.instances).toHaveLength(0);
      expect(component.segments().find((s) => s.id === 'seg-2')!.instances).toHaveLength(1);
    });

    it('shows a warning toast (not blocking) when the move creates segment conflicts (Fase 5, D2/D3)', () => {
      const inst = makeInstance({ id: 'inst-1' });
      const source = makeSegment({ id: 'seg-1', instances: [inst] });
      const target = makeSegment({ id: 'seg-2', instances: [] });
      component.segments.set([source, target]);
      const moveResult = {
        sourceSegment: { ...source, instances: [] },
        targetSegment: { ...target, instances: [inst] },
        conflicts: [{ personId: 'p1' }, { personId: 'p2' }],
      };
      (instanceService.move as ReturnType<typeof vi.fn>).mockReturnValue(of(moveResult));

      component.onInstanceDropped(target, makeCrossSegmentDrop(source, target, inst, 0, 0));

      expect(toastService.warning).toHaveBeenCalled();
      expect(component.segments().find((s) => s.id === 'seg-2')!.instances).toHaveLength(1);
    });

    it('does not show a warning toast when the move creates no conflicts', () => {
      const inst = makeInstance({ id: 'inst-1' });
      const source = makeSegment({ id: 'seg-1', instances: [inst] });
      const target = makeSegment({ id: 'seg-2', instances: [] });
      component.segments.set([source, target]);
      const moveResult = {
        sourceSegment: { ...source, instances: [] },
        targetSegment: { ...target, instances: [inst] },
      };
      (instanceService.move as ReturnType<typeof vi.fn>).mockReturnValue(of(moveResult));

      component.onInstanceDropped(target, makeCrossSegmentDrop(source, target, inst, 0, 0));

      expect(toastService.warning).not.toHaveBeenCalled();
    });

    it('shows a generic error toast on a move failure', () => {
      const inst = makeInstance({ id: 'inst-1' });
      const source = makeSegment({ id: 'seg-1', instances: [inst] });
      const target = makeSegment({ id: 'seg-2', instances: [] });
      component.segments.set([source, target]);
      (instanceService.move as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );

      component.onInstanceDropped(target, makeCrossSegmentDrop(source, target, inst, 0, 0));

      expect(toastService.error).toHaveBeenCalled();
    });
  });

  describe('inline editing', () => {
    it('startEdit sets editingSegmentId and editingName', () => {
      component.startEdit('seg-uuid-1', 'Bloc A');
      expect(component.editingSegmentId()).toBe('seg-uuid-1');
      expect(component.editingName()).toBe('Bloc A');
    });

    it('cancelEdit clears editingSegmentId', () => {
      component.startEdit('seg-uuid-1', 'Bloc A');
      component.cancelEdit();
      expect(component.editingSegmentId()).toBeNull();
    });
  });

  describe('onInstancesConfirmed()', () => {
    it('creates all instances in parallel and appends to segment', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [] });
      component.segments.set([seg]);
      component.pickerSegmentId.set('seg-1');

      const inst1 = makeInstance({ id: 'inst-1' });
      const inst2 = makeInstance({ id: 'inst-2' });
      (instanceService.create as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(of(inst1))
        .mockReturnValueOnce(of(inst2));

      component.onInstancesConfirmed([
        { figureTemplateId: 'fig-1' },
        { figureTemplateId: 'fig-2' },
      ]);

      expect(instanceService.create).toHaveBeenCalledTimes(2);
      expect(component.segments()[0].instances).toHaveLength(2);
    });

    it('shows success toast with count', () => {
      const seg = makeSegment({ id: 'seg-1' });
      component.segments.set([seg]);
      component.pickerSegmentId.set('seg-1');

      (instanceService.create as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(of(makeInstance({ id: 'i1' })))
        .mockReturnValueOnce(of(makeInstance({ id: 'i2' })));

      component.onInstancesConfirmed([
        { figureTemplateId: 'f1' },
        { figureTemplateId: 'f2' },
      ]);

      expect(toastService.success).toHaveBeenCalledWith('2 figures afegides.');
    });

    it('shows singular toast for single item', () => {
      const seg = makeSegment({ id: 'seg-1' });
      component.segments.set([seg]);
      component.pickerSegmentId.set('seg-1');

      (instanceService.create as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(of(makeInstance({ id: 'i1' })));

      component.onInstancesConfirmed([{ figureTemplateId: 'f1' }]);

      expect(toastService.success).toHaveBeenCalledWith('1 figura afegida.');
    });

    it('closes picker after successful batch', () => {
      const seg = makeSegment({ id: 'seg-1' });
      component.segments.set([seg]);
      component.pickerOpen.set(true);
      component.pickerSegmentId.set('seg-1');

      (instanceService.create as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(of(makeInstance()));

      component.onInstancesConfirmed([{ figureTemplateId: 'f1' }]);

      expect(component.pickerOpen()).toBe(false);
      expect(component.pickerSegmentId()).toBeNull();
    });

    it('shows error toast on failure', () => {
      const seg = makeSegment({ id: 'seg-1' });
      component.segments.set([seg]);
      component.pickerSegmentId.set('seg-1');

      (instanceService.create as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(throwError(() => new Error('API error')));

      component.onInstancesConfirmed([{ figureTemplateId: 'f1' }]);

      expect(toastService.error).toHaveBeenCalledWith('Error en afegir les figures.');
    });

    it('does nothing when segmentId is null', () => {
      component.pickerSegmentId.set(null);

      component.onInstancesConfirmed([{ figureTemplateId: 'f1' }]);

      expect(instanceService.create).not.toHaveBeenCalled();
    });

    it('does nothing when selections array is empty', () => {
      component.pickerSegmentId.set('seg-1');

      component.onInstancesConfirmed([]);

      expect(instanceService.create).not.toHaveBeenCalled();
    });
  });

  describe('onCompositionSelected()', () => {
    it('calls applyToSegment and replaces the matching segment in state', () => {
      const seg = makeSegment({ id: 'seg-1', name: null, instances: [] });
      component.segments.set([seg]);
      component.pickerSegmentId.set('seg-1');

      const updatedSegment = makeSegment({
        id: 'seg-1',
        name: 'Pilars de plaça',
        instances: [makeInstance({ id: 'inst-1' })],
      });
      compositionService.applyToSegment.mockReturnValue(of(updatedSegment));

      component.onCompositionSelected({ compositionId: 'comp-1', compositionName: 'Pilars de plaça' });

      expect(compositionService.applyToSegment).toHaveBeenCalledWith(EVENT_ID, 'seg-1', 'comp-1');
      expect(component.segments()[0]).toEqual(updatedSegment);
    });

    it('shows a success toast and closes the picker', () => {
      const seg = makeSegment({ id: 'seg-1' });
      component.segments.set([seg]);
      component.pickerOpen.set(true);
      component.pickerSegmentId.set('seg-1');

      compositionService.applyToSegment.mockReturnValue(of(makeSegment({ id: 'seg-1' })));

      component.onCompositionSelected({ compositionId: 'comp-1', compositionName: 'Pilars de plaça' });

      expect(toastService.success).toHaveBeenCalledWith('Composició «Pilars de plaça» aplicada.');
      expect(component.pickerOpen()).toBe(false);
      expect(component.pickerSegmentId()).toBeNull();
    });

    it('shows an error toast on failure', () => {
      const seg = makeSegment({ id: 'seg-1' });
      component.segments.set([seg]);
      component.pickerSegmentId.set('seg-1');

      compositionService.applyToSegment.mockReturnValue(throwError(() => new Error('API error')));

      component.onCompositionSelected({ compositionId: 'comp-1', compositionName: 'Pilars de plaça' });

      expect(toastService.error).toHaveBeenCalledWith('No s\'ha pogut aplicar la composició.');
    });

    it('does nothing when there is no open segment', () => {
      component.pickerSegmentId.set(null);

      component.onCompositionSelected({ compositionId: 'comp-1', compositionName: 'Pilars de plaça' });

      expect(compositionService.applyToSegment).not.toHaveBeenCalled();
    });
  });

  describe('navigateToAssignment()', () => {
    it('"Assignar" button calls navigateToAssignment with segment id', () => {
      const seg = makeSegment({ instances: [makeInstance()] });
      component.segments.set([seg]);
      fixture.detectChanges();
      component.navigateToAssignment(seg.id);
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', seg.id, 'assign'],
        { queryParams: { returnUrl: '/rehearsals/event-123' } },
      );
    });

    it('clicking figure name button navigates to instance assignment', () => {
      const seg = makeSegment({
        id: 'seg-1',
        instances: [makeInstance({ id: 'inst-1' })],
      });
      component.segments.set([seg]);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('[data-instance-id="inst-1"]');
      button.click();
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-1', 'assign', 'inst-1'],
        { queryParams: { returnUrl: '/rehearsals/event-123' } },
      );
    });

    it('navigates to correct assignment canvas URL', () => {
      component.navigateToAssignment('seg-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign'],
        { queryParams: { returnUrl: '/rehearsals/event-123' } },
      );
      component.navigateToAssignment('seg-uuid-1', 'inst-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign', 'inst-uuid-1'],
        { queryParams: { returnUrl: '/rehearsals/event-123' } },
      );
    });

    it('includes past=1 query param when isPast is true', () => {
      fixture.componentRef.setInput('isPast', true);
      fixture.detectChanges();
      component.navigateToAssignment('seg-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign'],
        { queryParams: { returnUrl: '/rehearsals/event-123', past: '1' } },
      );
    });

    it('does not include past query param when isPast is false', () => {
      fixture.componentRef.setInput('isPast', false);
      fixture.detectChanges();
      component.navigateToAssignment('seg-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign'],
        { queryParams: { returnUrl: '/rehearsals/event-123' } },
      );
    });

    it('passes tab=troncs when in troncs view mode, so the workspace opens on the Troncs tab', () => {
      (segmentService.getTroncView as ReturnType<typeof vi.fn>).mockReturnValue(of([]));
      component.setViewMode('troncs');
      component.navigateToAssignment('seg-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign'],
        { queryParams: { returnUrl: '/rehearsals/event-123', tab: 'troncs' } },
      );
    });

    it('does not pass a tab param in pinyes view mode', () => {
      component.navigateToAssignment('seg-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign'],
        { queryParams: { returnUrl: '/rehearsals/event-123' } },
      );
    });

    it('keeps the event page tab in returnUrl so coming back lands on Pinyes i Figures', () => {
      routerMock.url = '/events/event-123?tab=pinyes';
      component.navigateToAssignment('seg-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign'],
        { queryParams: { returnUrl: '/events/event-123?tab=pinyes' } },
      );
    });

    it('drops every other query param from returnUrl', () => {
      routerMock.url = '/events/event-123?tab=pinyes&returnUrl=%2Fold&foo=bar';
      component.navigateToAssignment('seg-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign'],
        { queryParams: { returnUrl: '/events/event-123?tab=pinyes' } },
      );
    });
  });

  describe('layout', () => {
    it('renders each instance as its own row', () => {
      const seg = makeSegment({
        id: 'seg-1',
        instances: [makeInstance({ id: 'inst-1' }), makeInstance({ id: 'inst-2' })],
      });
      component.segments.set([seg]);
      fixture.detectChanges();

      const instanceButtons = fixture.nativeElement.querySelectorAll('[data-instance-id]');
      expect(instanceButtons.length).toBe(2);
    });

    it('shows mode selector for figures with pinya', () => {
      const seg = makeSegment({
        id: 'seg-1',
        instances: [makeInstance({ id: 'inst-1', figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true } })],
      });
      component.segments.set([seg]);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('select[aria-label]');
      expect(select).toBeTruthy();
    });

    it('shows Neta badge for figures without pinya', () => {
      const seg = makeSegment({
        id: 'seg-1',
        instances: [makeInstance({ id: 'inst-1', figureTemplate: { id: 'f1', name: 'pd3n', hasPinya: false } })],
      });
      component.segments.set([seg]);
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.badge');
      expect(badge?.textContent?.trim()).toBe('Neta');
    });

    it('renders segment order number badge', () => {
      const seg0 = makeSegment({ id: 'seg-0', sortOrder: 0 });
      const seg1 = makeSegment({ id: 'seg-1', name: 'Bloc B', sortOrder: 1 });
      component.segments.set([seg0, seg1]);
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('[aria-label^="Segment "]');
      expect(badges[0].textContent.trim()).toBe('1');
      expect(badges[1].textContent.trim()).toBe('2');
    });
  });

  describe('viewMode toggle', () => {
    it('starts in pinyes mode by default', () => {
      expect(component.viewMode()).toBe('pinyes');
    });

    it('switches to troncs mode and loads tronc data', () => {
      (segmentService.getTroncView as ReturnType<typeof vi.fn>).mockReturnValue(of([]));

      component.setViewMode('troncs');

      expect(component.viewMode()).toBe('troncs');
      expect(segmentService.getTroncView).toHaveBeenCalledWith(EVENT_ID);
    });

    it('does not reload tronc data if already loaded', () => {
      (segmentService.getTroncView as ReturnType<typeof vi.fn>).mockReturnValue(of([]));

      component.setViewMode('troncs');
      component.setViewMode('pinyes');
      component.setViewMode('troncs');

      expect(segmentService.getTroncView).toHaveBeenCalledTimes(1);
    });

    it('stores tronc floor data indexed by instanceId', () => {
      const summary = [
        { instanceId: 'inst-1', floors: [{ z: 0, isBase: true, slots: ['Pepet', null] }] },
      ];
      (segmentService.getTroncView as ReturnType<typeof vi.fn>).mockReturnValue(of(summary));

      component.setViewMode('troncs');

      expect(component.troncData().get('inst-1')).toEqual(summary[0].floors);
    });

    it('shows error toast when tronc view fails', () => {
      (segmentService.getTroncView as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new Error()),
      );

      component.setViewMode('troncs');

      expect(toastService.error).toHaveBeenCalledWith('Error en carregar les dades del tronc.');
    });

    it('persists the selected mode so it is remembered across events', () => {
      (segmentService.getTroncView as ReturnType<typeof vi.fn>).mockReturnValue(of([]));

      component.setViewMode('troncs');

      expect(localStorage.getItem('muixer.pinyes.viewMode')).toBe('troncs');
    });

    it('restores a remembered troncs mode on init and loads tronc data', async () => {
      localStorage.setItem('muixer.pinyes.viewMode', 'troncs');
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [SegmentManagerComponent, DragDropModule],
        providers: [
          { provide: EventSegmentService, useValue: segmentService },
          { provide: FigureInstanceService, useValue: instanceService },
          { provide: CompositionService, useValue: compositionService },
          { provide: NodeAssignmentService, useValue: nodeAssignmentService },
          { provide: ToastService, useValue: toastService },
          { provide: Router, useValue: routerMock },
          allLucideIconsProvider,
        ],
      }).compileComponents();
      (segmentService.getTroncView as ReturnType<typeof vi.fn>).mockReturnValue(of([]));

      const otherFixture = TestBed.createComponent(SegmentManagerComponent);
      otherFixture.componentRef.setInput('eventId', EVENT_ID);
      otherFixture.detectChanges();

      expect(otherFixture.componentInstance.viewMode()).toBe('troncs');
      expect(segmentService.getTroncView).toHaveBeenCalledWith(EVENT_ID);
    });
  });

  describe('figurePinyaLabel()', () => {
    const loadSummary = (summary: EventAssignmentSummary) => {
      (nodeAssignmentService.getEventAssignmentSummary as ReturnType<typeof vi.fn>).mockReturnValue(of(summary));
      component.ngOnInit();
    };

    it('formats assigned/total pinya with cordons and grand total', () => {
      loadSummary({
        segments: [
          {
            segmentId: 'seg-1',
            segmentName: 'Bloc 1',
            conflicts: makeEmptyCounters(),
            sortOrder: 0,
            figures: [
              makeFigureSummary({
                instanceId: 'inst-uuid-1',
                pinya: makeAreaCount(12, 20),
                total: makeAreaCount(15, 24),
              }),
            ],
          },
        ],
      });
      const inst = makeInstance({ id: 'inst-uuid-1', numberOfCordons: 2, totalCordons: 4 });

      expect(component.figurePinyaLabel(inst)).toBe('12/20 pinya (2 cor.), 15/24 total');
    });

    it('omits the cordons qualifier when not configured', () => {
      loadSummary({
        segments: [
          {
            segmentId: 'seg-1',
            segmentName: 'Bloc 1',
            conflicts: makeEmptyCounters(),
            sortOrder: 0,
            figures: [
              makeFigureSummary({
                instanceId: 'inst-uuid-1',
                pinya: makeAreaCount(12, 20),
                total: makeAreaCount(15, 24),
              }),
            ],
          },
        ],
      });
      const inst = makeInstance({ id: 'inst-uuid-1', numberOfCordons: null, totalCordons: 4 });

      expect(component.figurePinyaLabel(inst)).toBe('12/20 pinya, 15/24 total');
    });

    it('omits the pinya fragment when there are no available pinya positions', () => {
      loadSummary({
        segments: [
          {
            segmentId: 'seg-1',
            segmentName: 'Bloc 1',
            conflicts: makeEmptyCounters(),
            sortOrder: 0,
            figures: [
              makeFigureSummary({
                instanceId: 'inst-uuid-1',
                pinya: makeAreaCount(0, 0),
                total: makeAreaCount(3, 3),
              }),
            ],
          },
        ],
      });
      const inst = makeInstance({ id: 'inst-uuid-1', figureMode: 'REMAT' });

      expect(component.figurePinyaLabel(inst)).toBe('3/3 total');
    });

    it('returns null when there is no summary data for the instance', () => {
      const inst = makeInstance({ id: 'unknown-instance' });
      expect(component.figurePinyaLabel(inst)).toBeNull();
    });
  });

  describe('segmentPeopleLabel()', () => {
    const loadSummary = (summary: EventAssignmentSummary) => {
      (nodeAssignmentService.getEventAssignmentSummary as ReturnType<typeof vi.fn>).mockReturnValue(of(summary));
      component.ngOnInit();
    };

    it('sums pinya and total across figures in pinya mode', () => {
      loadSummary({
        segments: [
          {
            segmentId: 'seg-1',
            segmentName: 'Bloc 1',
            conflicts: makeEmptyCounters(),
            sortOrder: 0,
            figures: [
              makeFigureSummary({ pinya: makeAreaCount(12, 20), total: makeAreaCount(15, 24) }),
              makeFigureSummary({ instanceId: 'inst-2', pinya: makeAreaCount(11, 15), total: makeAreaCount(14, 21) }),
            ],
          },
        ],
      });

      expect(component.segmentPeopleLabel(makeSegment({ id: 'seg-1' }))).toBe('23/35 pinyes, 29/45 total');
    });

    it('sums tronc and total across figures in troncs mode', () => {
      component.setViewMode('troncs');
      loadSummary({
        segments: [
          {
            segmentId: 'seg-1',
            segmentName: 'Bloc 1',
            conflicts: makeEmptyCounters(),
            sortOrder: 0,
            figures: [
              makeFigureSummary({ tronc: makeAreaCount(2, 5), total: makeAreaCount(15, 24) }),
              makeFigureSummary({ instanceId: 'inst-2', tronc: makeAreaCount(2, 5), total: makeAreaCount(14, 21) }),
            ],
          },
        ],
      });

      expect(component.segmentPeopleLabel(makeSegment({ id: 'seg-1' }))).toBe('4/10 troncs, 29/45 total');
    });

    it('omits the pinyes fragment when the segment has no available pinya positions', () => {
      loadSummary({
        segments: [
          {
            segmentId: 'seg-1',
            segmentName: 'Bloc 1',
            conflicts: makeEmptyCounters(),
            sortOrder: 0,
            figures: [makeFigureSummary({ pinya: makeAreaCount(0, 0), total: makeAreaCount(3, 3) })],
          },
        ],
      });

      expect(component.segmentPeopleLabel(makeSegment({ id: 'seg-1' }))).toBe('3/3 total');
    });

    it('returns null when there is no summary data for the segment', () => {
      expect(component.segmentPeopleLabel(makeSegment({ id: 'unknown-segment' }))).toBeNull();
    });
  });

  describe('segment conflict pill (Phase 3)', () => {
    const loadSummary = (summary: EventAssignmentSummary) => {
      (nodeAssignmentService.getEventAssignmentSummary as ReturnType<typeof vi.fn>).mockReturnValue(of(summary));
      component.ngOnInit();
    };

    const counters = (over: Partial<SegmentPeopleCounters> = {}): SegmentPeopleCounters => ({
      ...makeEmptyCounters(),
      ...over,
    });

    it('segmentConflictCount is 0 in production (no conflicts) so the pill fragment is hidden', () => {
      loadSummary({
        segments: [
          { segmentId: 'seg-1', segmentName: 'Bloc 1', conflicts: counters(), sortOrder: 0, figures: [makeFigureSummary()] },
        ],
      });
      expect(component.segmentConflictCount(makeSegment({ id: 'seg-1' }))).toBe(0);
    });

    it('segmentConflictCount reflects the segment conflictPersonCount', () => {
      loadSummary({
        segments: [
          {
            segmentId: 'seg-1',
            segmentName: 'Bloc 1',
            conflicts: counters({ conflictPersonCount: 3 }),
            sortOrder: 0,
            figures: [makeFigureSummary()],
          },
        ],
      });
      expect(component.segmentConflictCount(makeSegment({ id: 'seg-1' }))).toBe(3);
    });

    it('segmentDotacioTooltip reports distinct people per area', () => {
      loadSummary({
        segments: [
          {
            segmentId: 'seg-1',
            segmentName: 'Bloc 1',
            conflicts: counters({
              distinctPersonCount: 45,
              tronc: { distinctPersonCount: 8 },
              pinya: { distinctPersonCount: 43 },
            }),
            sortOrder: 0,
            figures: [makeFigureSummary()],
          },
        ],
      });
      const tooltip = component.segmentDotacioTooltip(makeSegment({ id: 'seg-1' }));
      expect(tooltip).toContain('8');
      expect(tooltip).toContain('43');
    });

    it('segmentConflictCount is 0 for a segment with no summary', () => {
      expect(component.segmentConflictCount(makeSegment({ id: 'unknown' }))).toBe(0);
    });
  });

  describe('showCordonsBadge()', () => {
    it('returns true when numberOfCordons is set and less than totalCordons', () => {
      const inst = makeInstance({
        figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true },
        figureMode: 'COMPLETA',
        numberOfCordons: 3,
        totalCordons: 5,
      });
      expect(component.showCordonsBadge(inst)).toBe(true);
    });

    it('returns false for REMAT instances', () => {
      const inst = makeInstance({
        figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true },
        figureMode: 'REMAT',
        numberOfCordons: 3,
        totalCordons: 5,
      });
      expect(component.showCordonsBadge(inst)).toBe(false);
    });

    it('returns false when numberOfCordons equals totalCordons', () => {
      const inst = makeInstance({
        figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true },
        figureMode: 'COMPLETA',
        numberOfCordons: 5,
        totalCordons: 5,
      });
      expect(component.showCordonsBadge(inst)).toBe(false);
    });

    it('returns false when numberOfCordons is null', () => {
      const inst = makeInstance({
        figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true },
        figureMode: 'COMPLETA',
        numberOfCordons: null,
        totalCordons: 5,
      });
      expect(component.showCordonsBadge(inst)).toBe(false);
    });

    it('returns false for figura neta (no pinya)', () => {
      const inst = makeInstance({
        figureTemplate: { id: 'f1', name: 'pd3n', hasPinya: false },
        figureMode: 'COMPLETA',
        numberOfCordons: 3,
        totalCordons: 5,
      });
      expect(component.showCordonsBadge(inst)).toBe(false);
    });
  });

  describe('troncSummaryText()', () => {
    const floors = [
      { z: 0, isBase: true, slots: ['Pepet', null, 'Maria'] },
      { z: 1, isBase: false, slots: ['Joan', '?'] },
      { z: 2, isBase: false, slots: [null] },
    ];

    beforeEach(() => {
      component.troncData.set(new Map([['inst-1', floors]]));
    });

    it('returns null when no data for instance', () => {
      const inst = makeInstance({ id: 'inst-999' });
      expect(component.troncSummaryText(inst)).toBeNull();
    });

    it('formats COMPLETA with all floors (base to top)', () => {
      const inst = makeInstance({ id: 'inst-1', figureMode: 'COMPLETA' });
      const result = component.troncSummaryText(inst);
      expect(result).toBe('Pepet - ? - Maria // Joan - ? // ?');
    });

    it('excludes BASE floor for REMAT', () => {
      const inst = makeInstance({ id: 'inst-1', figureMode: 'REMAT' });
      const result = component.troncSummaryText(inst);
      expect(result).toBe('Joan - ? // ?');
    });

    it('trims unassigned topmost floors for PEU', () => {
      const inst = makeInstance({ id: 'inst-1', figureMode: 'PEU' });
      const result = component.troncSummaryText(inst);
      // floor z=2 is entirely null → trimmed; z=1 has 'Joan' → kept; z=0 (base) kept
      expect(result).toBe('Pepet - ? - Maria // Joan - ?');
    });

    it('returns null for PEU when all floors are unassigned', () => {
      component.troncData.set(new Map([['inst-2', [
        { z: 0, isBase: true, slots: [null, null] },
        { z: 1, isBase: false, slots: [null] },
      ]]]));
      const inst = makeInstance({ id: 'inst-2', figureMode: 'PEU' });
      expect(component.troncSummaryText(inst)).toBeNull();
    });
  });

  describe('copy to segment', () => {
    it('openCopyPicker sets copyPickerInstanceId and copyPickerSegmentId', () => {
      component.openCopyPicker('seg-1', 'inst-1');
      expect(component.copyPickerSegmentId()).toBe('seg-1');
      expect(component.copyPickerInstanceId()).toBe('inst-1');
    });

    it('closeCopyPicker clears both pickers', () => {
      component.openCopyPicker('seg-1', 'inst-1');
      component.closeCopyPicker();
      expect(component.copyPickerSegmentId()).toBeNull();
      expect(component.copyPickerInstanceId()).toBeNull();
    });

    it('copyToSegment calls copy service and appends to target segment', () => {
      const sourceSeg = makeSegment({ id: 'seg-1', instances: [makeInstance({ id: 'inst-1' })] });
      const targetSeg = makeSegment({ id: 'seg-2', name: 'Bloc B', instances: [] });
      component.segments.set([sourceSeg, targetSeg]);

      const newInst = makeInstance({ id: 'inst-new' });
      (instanceService.copy as ReturnType<typeof vi.fn>).mockReturnValue(of(newInst));

      component.openCopyPicker('seg-1', 'inst-1');
      component.copyToSegment('seg-2');

      expect(instanceService.copy).toHaveBeenCalledWith(EVENT_ID, 'seg-1', 'inst-1', { targetSegmentId: 'seg-2' });
      expect(component.segments().find((s) => s.id === 'seg-2')!.instances).toHaveLength(1);
      expect(toastService.success).toHaveBeenCalledWith('Figura copiada al segment.');
      expect(component.copyPickerInstanceId()).toBeNull();
    });

    it('shows error toast when copy fails', () => {
      const sourceSeg = makeSegment({ id: 'seg-1', instances: [makeInstance()] });
      component.segments.set([sourceSeg]);
      (instanceService.copy as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => new Error()));

      component.openCopyPicker('seg-1', 'inst-uuid-1');
      component.copyToSegment('seg-2');

      expect(toastService.error).toHaveBeenCalledWith('Error en copiar la figura.');
    });

    it('otherSegments returns all segments except the given one', () => {
      const seg1 = makeSegment({ id: 'seg-1' });
      const seg2 = makeSegment({ id: 'seg-2', name: 'Bloc B' });
      const seg3 = makeSegment({ id: 'seg-3', name: 'Bloc C' });
      component.segments.set([seg1, seg2, seg3]);

      expect(component.otherSegments('seg-1')).toHaveLength(2);
      expect(component.otherSegments('seg-1').map((s) => s.id)).toEqual(['seg-2', 'seg-3']);
    });
  });

  describe('updateFigureMode()', () => {
    it('calls service directly when switching to PEU (no confirmation needed)', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance({ pinyaAssignedCount: 5 })] });
      const inst = seg.instances[0];
      const updated = makeInstance({ figureMode: 'PEU' as const });
      (instanceService.update as ReturnType<typeof vi.fn>).mockReturnValue(of(updated));
      component.segments.set([seg]);

      component.updateFigureMode(seg, inst, 'PEU');

      expect(instanceService.update).toHaveBeenCalledWith(EVENT_ID, seg.id, inst.id, { figureMode: 'PEU' });
      expect(component.pendingModeChange()).toBeNull();
    });

    it('calls service directly for REMAT when pinyaAssignedCount is 0', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance({ pinyaAssignedCount: 0 })] });
      const inst = seg.instances[0];
      const updated = makeInstance({ figureMode: 'REMAT' as const });
      (instanceService.update as ReturnType<typeof vi.fn>).mockReturnValue(of(updated));
      component.segments.set([seg]);

      component.updateFigureMode(seg, inst, 'REMAT');

      expect(instanceService.update).toHaveBeenCalledWith(EVENT_ID, seg.id, inst.id, { figureMode: 'REMAT' });
      expect(component.pendingModeChange()).toBeNull();
    });

    it('opens confirmation dialog when switching to REMAT with pinya assignments', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance({ pinyaAssignedCount: 3 })] });
      const inst = seg.instances[0];
      component.segments.set([seg]);

      component.updateFigureMode(seg, inst, 'REMAT');

      expect(instanceService.update).not.toHaveBeenCalled();
      expect(component.pendingModeChange()).toEqual({ segment: seg, instance: inst, mode: 'REMAT' });
    });

    it('shows the REMAT confirmation dialog in the DOM', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance({ pinyaAssignedCount: 2 })] });
      const inst = seg.instances[0];
      component.segments.set([seg]);
      component.updateFigureMode(seg, inst, 'REMAT');
      fixture.detectChanges();

      const dialog = fixture.nativeElement.querySelector('[aria-labelledby="remat-confirm-title"]');
      expect(dialog).toBeTruthy();
    });
  });

  describe('confirmModeChange()', () => {
    it('calls service with pending mode and clears dialog on success', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance({ pinyaAssignedCount: 3 })] });
      const inst = seg.instances[0];
      const updated = makeInstance({ figureMode: 'REMAT' as const, pinyaAssignedCount: 0 });
      (instanceService.update as ReturnType<typeof vi.fn>).mockReturnValue(of(updated));
      component.segments.set([seg]);
      component.pendingModeChange.set({ segment: seg, instance: inst, mode: 'REMAT' });

      component.confirmModeChange();

      expect(instanceService.update).toHaveBeenCalledWith(EVENT_ID, seg.id, inst.id, { figureMode: 'REMAT' });
      expect(component.pendingModeChange()).toBeNull();
    });

    it('clears dialog and shows toast on API error', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance({ pinyaAssignedCount: 1 })] });
      const inst = seg.instances[0];
      (instanceService.update as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => new Error()));
      component.segments.set([seg]);
      component.pendingModeChange.set({ segment: seg, instance: inst, mode: 'REMAT' });

      component.confirmModeChange();

      expect(toastService.error).toHaveBeenCalled();
      expect(component.pendingModeChange()).toBeNull();
      expect(component.savingModeChange()).toBe(false);
    });
  });

  describe('cancelModeChange()', () => {
    it('clears pendingModeChange', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance()] });
      const inst = seg.instances[0];
      component.pendingModeChange.set({ segment: seg, instance: inst, mode: 'REMAT' });

      component.cancelModeChange();

      expect(component.pendingModeChange()).toBeNull();
    });
  });

  describe('isLocked gating', () => {
    function setLockedWithSegment() {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance({ id: 'inst-1' })] });
      component.segments.set([seg]);
      fixture.componentRef.setInput('isLocked', true);
      fixture.detectChanges();
      return seg;
    }

    it('hides "Segment nou"', () => {
      fixture.componentRef.setInput('isLocked', true);
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('[aria-label="Afegir segment nou"]');
      expect(btn).toBeNull();
    });

    it('renders "Segment nou" when unlocked', () => {
      fixture.componentRef.setInput('isLocked', false);
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector('[aria-label="Afegir segment nou"]');
      expect(btn).not.toBeNull();
    });

    it('hides segment delete', () => {
      setLockedWithSegment();

      const btn = fixture.nativeElement.querySelector('[aria-label="Eliminar segment"]');
      expect(btn).toBeNull();
    });

    it('replaces the segment rename trigger with read-only text', () => {
      setLockedWithSegment();

      const trigger = fixture.nativeElement.querySelector('[data-testid="segment-rename-trigger"]');
      const readonly = fixture.nativeElement.querySelector('[data-testid="segment-name-readonly"]');
      expect(trigger).toBeNull();
      expect(readonly).not.toBeNull();
      expect(readonly.textContent).toContain('Bloc A');
    });

    it('hides the segment drag handle', () => {
      setLockedWithSegment();

      const btn = fixture.nativeElement.querySelector('[aria-label="Arrossega per reordenar el segment"]');
      expect(btn).toBeNull();
    });

    it('hides "+ Figura" (blocks add-figure and apply-composition entry point)', () => {
      setLockedWithSegment();

      const btn = fixture.nativeElement.querySelector('[aria-label="Afegir figura o composició al segment"]');
      expect(btn).toBeNull();
    });

    it('hides the instance drag handle', () => {
      setLockedWithSegment();

      const btn = fixture.nativeElement.querySelector('[aria-label="Arrossega per reordenar"]');
      expect(btn).toBeNull();
    });

    it('keeps the figure-mode select visible but disabled', () => {
      setLockedWithSegment();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      expect(select).not.toBeNull();
      expect(select.disabled).toBe(true);
    });

    it('hides delete-instance', () => {
      const seg = setLockedWithSegment();
      const label = component.getInstanceLabel(seg.instances[0]);

      const btn = fixture.nativeElement.querySelector(`[aria-label="Treure ${label} del segment"]`);
      expect(btn).toBeNull();
    });

    it('leaves the visibility toggle enabled (not locked server-side)', () => {
      setLockedWithSegment();

      const visibilityBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[aria-label*="Visible"], [aria-label*="Ocult"]',
      );
      expect(visibilityBtn.disabled).toBe(false);
    });

    it('hides copy-to-segment', () => {
      const seg = setLockedWithSegment();
      const label = component.getInstanceLabel(seg.instances[0]);

      const copyBtn = fixture.nativeElement.querySelector(
        `[aria-label="Copia ${label} a un altre segment"]`,
      );
      expect(copyBtn).toBeNull();
    });

    it('renders copy-to-segment when unlocked', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance({ id: 'inst-1' })] });
      component.segments.set([seg]);
      fixture.componentRef.setInput('isLocked', false);
      fixture.detectChanges();
      const label = component.getInstanceLabel(seg.instances[0]);

      const copyBtn = fixture.nativeElement.querySelector(
        `[aria-label="Copia ${label} a un altre segment"]`,
      );
      expect(copyBtn).not.toBeNull();
    });

    it('renders mutating controls when unlocked', () => {
      const seg = makeSegment({ id: 'seg-1', instances: [makeInstance({ id: 'inst-1' })] });
      component.segments.set([seg]);
      fixture.componentRef.setInput('isLocked', false);
      fixture.detectChanges();

      const addFigureBtn = fixture.nativeElement.querySelector(
        '[aria-label="Afegir figura o composició al segment"]',
      );
      const deleteBtn = fixture.nativeElement.querySelector('[aria-label="Eliminar segment"]');
      expect(addFigureBtn).not.toBeNull();
      expect(deleteBtn).not.toBeNull();
    });
  });
});
