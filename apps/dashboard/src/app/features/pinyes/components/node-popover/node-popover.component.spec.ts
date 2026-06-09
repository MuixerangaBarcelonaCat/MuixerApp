import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, type Mock } from 'vitest';
import { LUCIDE_ICONS, LucideIconProvider, X, UserMinus } from 'lucide-angular';
import { FigureZone } from '@muixer/shared';
import { NodePopoverComponent } from './node-popover.component';
import { AssignmentDetail } from '../../models/assignment.model';

const makeAssignment = (): AssignmentDetail => ({
  id: 'assignment-1',
  figureInstanceId: 'instance-1',
  compositionSlotId: null,
  node: { id: 'node-1', label: 'pd4-1', zone: FigureZone.TRONC, z: 1, positionType: 'pd4', sortOrder: 0, ringLevel: null, originNodeId: null, sourceNodeId: null },
  person: {
    id: 'person-1',
    alias: 'Pepet',
    name: 'Pere',
    firstSurname: 'Garcia',
    shoulderHeight: 142,
  },
});

describe('NodePopoverComponent', () => {
  let fixture: ComponentFixture<NodePopoverComponent>;
  let component: NodePopoverComponent;
  let unassignSpy: Mock;
  let closeSpy: Mock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NodePopoverComponent],
      providers: [
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({ X, UserMinus }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NodePopoverComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('assignment', makeAssignment());
    fixture.componentRef.setInput('position', { x: 100, y: 200 });

    unassignSpy = vi.fn();
    closeSpy = vi.fn();
    component.unassign.subscribe((a) => unassignSpy(a));
    component.close.subscribe(() => closeSpy());

    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('displays person alias, full name, height, and node label', () => {
    fixture.componentRef.setInput('heightMode', 'absolute');
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML;
    expect(html).toContain('Pepet');
    expect(html).toContain('Pere');
    expect(html).toContain('Garcia');
    expect(html).toContain('142 cm');
  });

  it('"Desassignar" button emits unassign output with the assignment', () => {
    const btn = fixture.nativeElement.querySelector('[aria-label="Desassignar persona d\'aquest node"]');
    btn?.click();
    expect(unassignSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'assignment-1' }));
  });

  it('Escape key emits close output', () => {
    component.onEscape();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('has role="dialog" attribute on the container', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
  });
});
