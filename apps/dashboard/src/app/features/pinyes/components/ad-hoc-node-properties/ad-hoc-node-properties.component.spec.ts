import { InstanceNodeItem } from '@muixer/pinyes-render';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { AdHocNodePropertiesComponent } from './ad-hoc-node-properties.component';
import { ColorPickerComponent } from '../../../../shared/components/forms/color-picker/color-picker.component';
import { By } from '@angular/platform-browser';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { NODE_TYPE_PALETTE, ToastService } from '@muixer/ui';
import { FigureZone, NodeShape } from '@muixer/shared';

const makeNode = (overrides: Partial<InstanceNodeItem> = {}): InstanceNodeItem => ({
  id: 'node-1',
  label: 'vent-1',
  zone: FigureZone.PINYA,
  positionType: 'mans',
  x: 100, y: 100, z: 0,
  width: 60, height: 40, rotation: 0,
  color: null, shape: NodeShape.ELLIPSE,
  sortOrder: 0, climbIndicator: null, ringLevel: null,
  originNodeId: null, renglaId: null, renglaPosition: null,
  sourceNodeId: null, isSnapshotted: true, isAdHoc: true, createdById: null,
  ...overrides,
});

describe('AdHocNodePropertiesComponent', () => {
  let fixture: ComponentFixture<AdHocNodePropertiesComponent>;
  let component: AdHocNodePropertiesComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdHocNodePropertiesComponent],
      providers: [
        { provide: NodeAssignmentService, useValue: { updateAdHocNode: vi.fn().mockReturnValue(of({})) } },
        { provide: ToastService, useValue: { error: vi.fn() } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdHocNodePropertiesComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('node', makeNode());
    fixture.componentRef.setInput('instanceId', 'inst-1');
    fixture.detectChanges();
  });

  // ── color ──────────────────────────────────────────────────────────────

  describe('color', () => {
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

    it('shows the type color in the swatch while the node has no color of its own', () => {
      fixture.componentRef.setInput('node', makeNode({ positionType: 'comodin', color: null }));
      fixture.detectChanges();
      expect(component.colorFallback()).toBe(NODE_TYPE_PALETTE['comodin'].wash);
      expect(text()).toContain('Color per defecte');
    });

    it('puts a customized node back on its type color when the color picker resets it', () => {
      const service = TestBed.inject(NodeAssignmentService) as unknown as { updateAdHocNode: ReturnType<typeof vi.fn> };
      fixture.componentRef.setInput('node', makeNode({ positionType: 'comodin', color: '#123456' }));
      fixture.detectChanges();
      const picker = fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance as ColorPickerComponent;

      picker.colorReset.emit();

      expect(service.updateAdHocNode).toHaveBeenCalledWith('inst-1', 'node-1', { color: null });
    });

    it('says an uncolored decoration has no fill', () => {
      fixture.componentRef.setInput('node', makeNode({ zone: FigureZone.DECORATION, positionType: 'circle', color: null }));
      fixture.detectChanges();
      expect(component.colorFallback()).toBeNull();
      expect(text()).toContain('Sense fons');
    });
  });

  // ── attendanceBadgeVariant ───────────────────────────────────────────────

  describe('attendanceBadgeVariant (before the event day)', () => {
    beforeEach(() => fixture.componentRef.setInput('phase', 'before'));

    it.each([
      ['ASSISTIT', 'success'],
      ['ANIRE', 'success'],
      ['NO_VAIG', 'error'],
      ['PENDENT', 'warning'],
      [null, 'ghost'],
    ])('status=%s → %s', (status, expected) => {
      fixture.componentRef.setInput('attendanceStatus', status);
      fixture.detectChanges();
      expect(component.attendanceBadgeVariant()).toBe(expected);
    });
  });

  describe('attendanceBadgeVariant (on the event day, before the start time)', () => {
    beforeEach(() => fixture.componentRef.setInput('phase', 'day'));

    it('ANIRE → success (still coming)', () => {
      fixture.componentRef.setInput('attendanceStatus', 'ANIRE');
      fixture.detectChanges();
      expect(component.attendanceBadgeVariant()).toBe('success');
    });
  });

  describe('attendanceBadgeVariant (from the start time on)', () => {
    beforeEach(() => fixture.componentRef.setInput('phase', 'started'));

    it('ANIRE → warning (no ha arribat)', () => {
      fixture.componentRef.setInput('attendanceStatus', 'ANIRE');
      fixture.detectChanges();
      expect(component.attendanceBadgeVariant()).toBe('warning');
    });

    it('ASSISTIT → success', () => {
      fixture.componentRef.setInput('attendanceStatus', 'ASSISTIT');
      fixture.detectChanges();
      expect(component.attendanceBadgeVariant()).toBe('success');
    });
  });

  // ── attendanceLabel ────────────────────────────────────────────────────

  describe('attendanceLabel (shared phase labels)', () => {
    it.each([
      ['before', 'ANIRE', 'Ve'],
      ['before', 'NO_VAIG', 'No ve'],
      ['before', 'PENDENT', 'Pendent'],
      ['day', 'ASSISTIT', 'Ha arribat'],
      ['day', 'ANIRE', 'Ve'],
      ['started', 'ANIRE', 'No ha arribat'],
      ['after', 'ASSISTIT', 'Va vindre'],
      ['after', 'NO_VAIG', 'No va vindre'],
    ] as const)('%s / %s → "%s"', (phase, status, expected) => {
      fixture.componentRef.setInput('phase', phase);
      fixture.componentRef.setInput('attendanceStatus', status);
      fixture.detectChanges();
      expect(component.attendanceLabel()).toBe(expected);
    });

    it('reads "Assignat/da" with no attendance status', () => {
      fixture.componentRef.setInput('attendanceStatus', null);
      fixture.detectChanges();
      expect(component.attendanceLabel()).toBe('Assignat/da');
    });
  });

});
