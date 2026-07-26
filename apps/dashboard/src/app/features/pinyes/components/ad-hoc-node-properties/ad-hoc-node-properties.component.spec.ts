import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { AdHocNodePropertiesComponent } from './ad-hoc-node-properties.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { InstanceNodeItem } from '../../models/assignment.model';
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

  // ── attendanceBadgeClass ────────────────────────────────────────────────

  describe('attendanceBadgeClass (isPast=false)', () => {
    beforeEach(() => fixture.componentRef.setInput('isPast', false));

    it.each([
      ['ASSISTIT', 'badge-success'],
      ['ANIRE', 'badge-success'],
      ['NO_VAIG', 'badge-error'],
      ['PENDENT', 'badge-warning'],
      [null, 'badge-ghost'],
    ])('status=%s → %s', (status, expected) => {
      fixture.componentRef.setInput('attendanceStatus', status);
      fixture.detectChanges();
      expect(component.attendanceBadgeClass()).toBe(expected);
    });
  });

  describe('attendanceBadgeClass (isPast=true)', () => {
    beforeEach(() => fixture.componentRef.setInput('isPast', true));

    it('ANIRE → badge-warning (no presentat)', () => {
      fixture.componentRef.setInput('attendanceStatus', 'ANIRE');
      fixture.detectChanges();
      expect(component.attendanceBadgeClass()).toBe('badge-warning');
    });

    it('ASSISTIT → badge-success', () => {
      fixture.componentRef.setInput('attendanceStatus', 'ASSISTIT');
      fixture.detectChanges();
      expect(component.attendanceBadgeClass()).toBe('badge-success');
    });
  });

  // ── attendanceLabel ────────────────────────────────────────────────────

  describe('attendanceLabel (isPast=false)', () => {
    beforeEach(() => fixture.componentRef.setInput('isPast', false));

    it.each([
      ['ASSISTIT', 'Assistit'],
      ['ANIRE', 'Vinc'],
      ['NO_VAIG', 'No vinc'],
      ['PENDENT', 'Pendent'],
      [null, 'Assignat/da'],
    ])('status=%s → "%s"', (status, expected) => {
      fixture.componentRef.setInput('attendanceStatus', status);
      fixture.detectChanges();
      expect(component.attendanceLabel()).toBe(expected);
    });
  });

  describe('attendanceLabel (isPast=true)', () => {
    beforeEach(() => fixture.componentRef.setInput('isPast', true));

    it('ANIRE → No presentat', () => {
      fixture.componentRef.setInput('attendanceStatus', 'ANIRE');
      fixture.detectChanges();
      expect(component.attendanceLabel()).toBe('No presentat');
    });

    it('ASSISTIT → Assistit', () => {
      fixture.componentRef.setInput('attendanceStatus', 'ASSISTIT');
      fixture.detectChanges();
      expect(component.attendanceLabel()).toBe('Assistit');
    });
  });

});
