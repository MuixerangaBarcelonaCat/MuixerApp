import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { ToastService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { FigureModeChangeComponent } from './figure-mode-change.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { FigureInstanceService } from '../../services/figure-instance.service';

const EVENT_ID = 'event-1';
const SEGMENT_ID = 'seg-1';
const INSTANCE_ID = 'inst-a';

type MockFn = ReturnType<typeof vi.fn>;

describe('FigureModeChangeComponent', () => {
  let fixture: ComponentFixture<FigureModeChangeComponent>;
  let component: FigureModeChangeComponent;
  let nodeAssignmentService: { previewFigureModeImpact: MockFn };
  let instanceService: { update: MockFn };
  let toast: { success: MockFn; error: MockFn; info: MockFn; warning: MockFn };

  const setup = async () => {
    nodeAssignmentService = { previewFigureModeImpact: vi.fn() };
    instanceService = { update: vi.fn().mockReturnValue(of({ id: INSTANCE_ID, figureMode: 'REMAT' })) };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [FigureModeChangeComponent],
      providers: [
        allLucideIconsProvider,
        { provide: NodeAssignmentService, useValue: nodeAssignmentService },
        { provide: FigureInstanceService, useValue: instanceService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FigureModeChangeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('applies immediately for COMPLETA/PEU without previewing impact', async () => {
    await setup();

    component.request(EVENT_ID, SEGMENT_ID, INSTANCE_ID, 'Pilar 1', 'PEU');

    expect(nodeAssignmentService.previewFigureModeImpact).not.toHaveBeenCalled();
    expect(instanceService.update).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, INSTANCE_ID, { figureMode: 'PEU' });
  });

  it('applies immediately for REMAT/NETA when the backend preview reports no affected assignments', async () => {
    await setup();
    nodeAssignmentService.previewFigureModeImpact.mockReturnValue(of({ affectedCount: 0 }));

    component.request(EVENT_ID, SEGMENT_ID, INSTANCE_ID, 'Pilar 1', 'NETA');

    expect(nodeAssignmentService.previewFigureModeImpact).toHaveBeenCalledWith(INSTANCE_ID, 'NETA');
    expect(instanceService.update).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, INSTANCE_ID, { figureMode: 'NETA' });
    expect(component.pending()).toBeNull();
  });

  it('shows a confirmation with the backend-reported count instead of applying directly when impact > 0', async () => {
    await setup();
    nodeAssignmentService.previewFigureModeImpact.mockReturnValue(of({ affectedCount: 2 }));

    component.request(EVENT_ID, SEGMENT_ID, INSTANCE_ID, 'Pilar 1', 'REMAT');

    expect(instanceService.update).not.toHaveBeenCalled();
    expect(component.pending()).toEqual({
      eventId: EVENT_ID,
      segmentId: SEGMENT_ID,
      instanceId: INSTANCE_ID,
      label: 'Pilar 1',
      mode: 'REMAT',
      affectedCount: 2,
    });
  });

  it('applies the pending change and emits the updated instance on confirm', async () => {
    await setup();
    nodeAssignmentService.previewFigureModeImpact.mockReturnValue(of({ affectedCount: 1 }));
    const updated = { id: INSTANCE_ID, figureMode: 'NETA' };
    instanceService.update.mockReturnValue(of(updated));
    let emitted: unknown;
    component.changed.subscribe((v) => (emitted = v));

    component.request(EVENT_ID, SEGMENT_ID, INSTANCE_ID, 'Pilar 1', 'NETA');
    component.confirm();

    expect(instanceService.update).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, INSTANCE_ID, { figureMode: 'NETA' });
    expect(emitted).toEqual(updated);
    expect(component.pending()).toBeNull();
  });

  it('does not apply anything when the pending change is cancelled', async () => {
    await setup();
    nodeAssignmentService.previewFigureModeImpact.mockReturnValue(of({ affectedCount: 1 }));

    component.request(EVENT_ID, SEGMENT_ID, INSTANCE_ID, 'Pilar 1', 'REMAT');
    component.cancel();

    expect(instanceService.update).not.toHaveBeenCalled();
    expect(component.pending()).toBeNull();
  });

  it('shows an error toast and does not apply when the preview call fails', async () => {
    await setup();
    nodeAssignmentService.previewFigureModeImpact.mockReturnValue(throwError(() => new Error('boom')));

    component.request(EVENT_ID, SEGMENT_ID, INSTANCE_ID, 'Pilar 1', 'REMAT');

    expect(toast.error).toHaveBeenCalled();
    expect(instanceService.update).not.toHaveBeenCalled();
  });

  it('shows an error toast when applying the change fails', async () => {
    await setup();
    nodeAssignmentService.previewFigureModeImpact.mockReturnValue(of({ affectedCount: 1 }));
    instanceService.update.mockReturnValue(throwError(() => new Error('boom')));

    component.request(EVENT_ID, SEGMENT_ID, INSTANCE_ID, 'Pilar 1', 'REMAT');
    component.confirm();

    expect(toast.error).toHaveBeenCalled();
    expect(component.pending()).toBeNull();
  });

  it('supports requests for different event/segment pairs across consecutive calls', async () => {
    await setup();
    nodeAssignmentService.previewFigureModeImpact.mockReturnValue(of({ affectedCount: 0 }));

    component.request('event-2', 'seg-2', 'inst-b', 'Pilar 2', 'PEU');

    expect(instanceService.update).toHaveBeenCalledWith('event-2', 'seg-2', 'inst-b', { figureMode: 'PEU' });
  });
});
