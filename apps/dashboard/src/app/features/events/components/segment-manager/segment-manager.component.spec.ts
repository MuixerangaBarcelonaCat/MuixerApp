import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import {
  LUCIDE_ICONS, LucideIconProvider,
  Check, ChevronDown, ChevronUp, Clock, Eye, EyeOff, FileText, Hexagon, Layers,
  LayoutGrid, Monitor, Plus, Trash2, Users, X,
} from 'lucide-angular';
import { SegmentManagerComponent } from './segment-manager.component';
import { EventSegmentService } from '../../../pinyes/services/event-segment.service';
import { FigureInstanceService } from '../../../pinyes/services/figure-instance.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { SegmentDetail } from '../../../pinyes/models/segment.model';

const EVENT_ID = 'event-uuid-1';

const makeSegment = (overrides: Partial<SegmentDetail> = {}): SegmentDetail => ({
  id: 'seg-uuid-1',
  name: 'Bloc A',
  sortOrder: 0,
  startTime: null,
  endTime: null,
  notes: null,
  isVisible: false,
  instances: [],
  ...overrides,
});

const makeInstance = (overrides = {}) => ({
  id: 'inst-uuid-1',
  label: null,
  sortOrder: 0,
  snapshotted: false,
  assignedCount: 0,
  numberOfCordons: null,
  openCordons: null,
  projectionX: null,
  projectionY: null,
  projectionScale: 1,
  figureTemplate: { id: 'fig-1', name: 'pd4' },
  compositionTemplate: null,
  ...overrides,
});

describe('SegmentManagerComponent', () => {
  let fixture: ComponentFixture<SegmentManagerComponent>;
  let component: SegmentManagerComponent;
  let segmentService: Partial<EventSegmentService>;
  let instanceService: Partial<FigureInstanceService>;
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    segmentService = {
      getByEvent: vi.fn().mockReturnValue(of({ data: [] })),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
    };

    instanceService = {
      create: vi.fn(),
      remove: vi.fn(),
    };

    toastService = {
      success: vi.fn(),
      error: vi.fn(),
    };

    routerMock = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SegmentManagerComponent],
      providers: [
        { provide: EventSegmentService, useValue: segmentService },
        { provide: FigureInstanceService, useValue: instanceService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: routerMock },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({
            Check, ChevronDown, ChevronUp, Clock, Eye, EyeOff, FileText, Hexagon, Layers,
            LayoutGrid, Monitor, Plus, Trash2, Users, X,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SegmentManagerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('eventId', EVENT_ID);
    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('loads segments on init', () => {
    expect(segmentService.getByEvent).toHaveBeenCalledWith(EVENT_ID);
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
          { id: 'i1', label: null, sortOrder: 0, snapshotted: false, assignedCount: 0, numberOfCordons: null, openCordons: null, projectionX: null, projectionY: null, projectionScale: 1, figureTemplate: { id: 'f1', name: 'pd4' }, compositionTemplate: null },
          { id: 'i2', label: null, sortOrder: 1, snapshotted: false, assignedCount: 0, numberOfCordons: null, openCordons: null, projectionX: null, projectionY: null, projectionScale: 1, figureTemplate: null, compositionTemplate: { id: 'c1', name: 'Altar' } },
        ],
      });
      expect(component.displayName()(seg)).toBe('pd4 + Altar');
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
    it('calls update with inverted isVisible and updates the list', () => {
      const seg = makeSegment({ isVisible: false });
      const updated = { ...seg, isVisible: true };
      component.segments.set([seg]);
      (segmentService.update as ReturnType<typeof vi.fn>).mockReturnValue(of(updated));

      component.toggleVisibility(seg);

      expect(segmentService.update).toHaveBeenCalledWith(EVENT_ID, seg.id, { isVisible: true });
      expect(component.segments()[0].isVisible).toBe(true);
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

  describe('moveSegment()', () => {
    it('moves segment up and calls reorder', () => {
      const seg0 = makeSegment({ id: 'seg-0', sortOrder: 0 });
      const seg1 = makeSegment({ id: 'seg-1', sortOrder: 1 });
      component.segments.set([seg0, seg1]);
      (segmentService.reorder as ReturnType<typeof vi.fn>).mockReturnValue(of(undefined));

      component.moveSegment(seg1, 'up');

      expect(component.segments()[0].id).toBe('seg-1');
      expect(component.segments()[1].id).toBe('seg-0');
      expect(segmentService.reorder).toHaveBeenCalledWith(EVENT_ID, ['seg-1', 'seg-0']);
    });

    it('does nothing when moving the first segment up', () => {
      const seg = makeSegment({ id: 'seg-0', sortOrder: 0 });
      component.segments.set([seg]);

      component.moveSegment(seg, 'up');

      expect(segmentService.reorder).not.toHaveBeenCalled();
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

  describe('navigateToAssignment()', () => {
    it('"Assignar" button calls navigateToAssignment with segment id', () => {
      const seg = makeSegment({ instances: [makeInstance()] });
      component.segments.set([seg]);
      fixture.detectChanges();
      component.navigateToAssignment(seg.id);
      expect(routerMock.navigate).toHaveBeenCalledWith([
        '/pinyes/events', EVENT_ID, 'segments', seg.id, 'assign',
      ]);
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
      expect(routerMock.navigate).toHaveBeenCalledWith([
        '/pinyes/events',
        EVENT_ID,
        'segments',
        'seg-1',
        'assign',
        'inst-1',
      ]);
    });

    it('navigates to correct assignment canvas URL', () => {
      component.navigateToAssignment('seg-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith([
        '/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign',
      ]);
      component.navigateToAssignment('seg-uuid-1', 'inst-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith([
        '/pinyes/events', EVENT_ID, 'segments', 'seg-uuid-1', 'assign',
        'inst-uuid-1',
      ]);
    });
  });
});
