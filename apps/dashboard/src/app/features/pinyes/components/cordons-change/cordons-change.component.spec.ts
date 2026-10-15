import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { ToastService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { CordonsChangeComponent } from './cordons-change.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';

const INSTANCE_ID = 'inst-a';

type MockFn = ReturnType<typeof vi.fn>;

describe('CordonsChangeComponent', () => {
  let fixture: ComponentFixture<CordonsChangeComponent>;
  let component: CordonsChangeComponent;
  let nodeAssignmentService: { previewCordonsImpact: MockFn; previewCordonsObertsImpact: MockFn; updateCordons: MockFn };
  let toast: { success: MockFn; error: MockFn; info: MockFn; warning: MockFn };

  const setup = async () => {
    nodeAssignmentService = {
      previewCordonsImpact: vi.fn(),
      previewCordonsObertsImpact: vi.fn(),
      updateCordons: vi.fn().mockReturnValue(of({ numberOfCordons: 2, cordonsObertsEnabled: true, removedAssignments: 0 })),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CordonsChangeComponent],
      providers: [
        allLucideIconsProvider,
        { provide: NodeAssignmentService, useValue: nodeAssignmentService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CordonsChangeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('applies immediately for "Tots" (null) without previewing impact', async () => {
    await setup();

    component.request(INSTANCE_ID, null);

    expect(nodeAssignmentService.previewCordonsImpact).not.toHaveBeenCalled();
    expect(nodeAssignmentService.updateCordons).toHaveBeenCalledWith(INSTANCE_ID, { numberOfCordons: null });
  });

  it('applies immediately when the backend preview reports no affected assignments', async () => {
    await setup();
    nodeAssignmentService.previewCordonsImpact.mockReturnValue(of({ affectedCount: 0 }));

    component.request(INSTANCE_ID, 2);

    expect(nodeAssignmentService.previewCordonsImpact).toHaveBeenCalledWith(INSTANCE_ID, 2);
    expect(nodeAssignmentService.updateCordons).toHaveBeenCalledWith(INSTANCE_ID, { numberOfCordons: 2 });
    expect(component.pending()).toBeNull();
  });

  it('shows a confirmation with the backend-reported count instead of applying directly when impact > 0', async () => {
    await setup();
    nodeAssignmentService.previewCordonsImpact.mockReturnValue(of({ affectedCount: 3 }));

    component.request(INSTANCE_ID, 1);

    expect(nodeAssignmentService.updateCordons).not.toHaveBeenCalled();
    expect(component.pending()).toEqual({ kind: 'count', instanceId: INSTANCE_ID, numberOfCordons: 1, affectedCount: 3 });
  });

  it('applies the pending change and emits the result on confirm', async () => {
    await setup();
    nodeAssignmentService.previewCordonsImpact.mockReturnValue(of({ affectedCount: 1 }));
    const result = { numberOfCordons: 1, cordonsObertsEnabled: true, removedAssignments: 1 };
    nodeAssignmentService.updateCordons.mockReturnValue(of(result));
    let emitted: unknown;
    component.changed.subscribe((v) => (emitted = v));

    component.request(INSTANCE_ID, 1);
    component.confirm();

    expect(nodeAssignmentService.updateCordons).toHaveBeenCalledWith(INSTANCE_ID, { numberOfCordons: 1 });
    expect(emitted).toEqual(result);
    expect(component.pending()).toBeNull();
  });

  it('shows a toast naming how many were unassigned when the apply actually removes assignments', async () => {
    await setup();
    nodeAssignmentService.previewCordonsImpact.mockReturnValue(of({ affectedCount: 2 }));
    nodeAssignmentService.updateCordons.mockReturnValue(
      of({ numberOfCordons: 1, cordonsObertsEnabled: true, removedAssignments: 2 }),
    );

    component.request(INSTANCE_ID, 1);
    component.confirm();

    expect(toast.warning).toHaveBeenCalledWith("S'han desassignat 2 persones que quedaven fora dels cordons.");
  });

  it('does not apply anything when the pending change is cancelled', async () => {
    await setup();
    nodeAssignmentService.previewCordonsImpact.mockReturnValue(of({ affectedCount: 1 }));

    component.request(INSTANCE_ID, 1);
    component.cancel();

    expect(nodeAssignmentService.updateCordons).not.toHaveBeenCalled();
    expect(component.pending()).toBeNull();
  });

  it('shows an error toast and does not apply when the preview call fails', async () => {
    await setup();
    nodeAssignmentService.previewCordonsImpact.mockReturnValue(throwError(() => new Error('boom')));

    component.request(INSTANCE_ID, 1);

    expect(toast.error).toHaveBeenCalled();
    expect(nodeAssignmentService.updateCordons).not.toHaveBeenCalled();
  });

  it('shows an error toast when applying the change fails', async () => {
    await setup();
    nodeAssignmentService.previewCordonsImpact.mockReturnValue(of({ affectedCount: 1 }));
    nodeAssignmentService.updateCordons.mockReturnValue(throwError(() => new Error('boom')));

    component.request(INSTANCE_ID, 1);
    component.confirm();

    expect(toast.error).toHaveBeenCalled();
    expect(component.pending()).toBeNull();
  });

  describe('cordons oberts', () => {
    it('enables immediately without previewing impact', async () => {
      await setup();

      component.requestCordonsOberts(INSTANCE_ID, true);

      expect(nodeAssignmentService.previewCordonsObertsImpact).not.toHaveBeenCalled();
      expect(nodeAssignmentService.updateCordons).toHaveBeenCalledWith(INSTANCE_ID, { cordonsObertsEnabled: true });
    });

    it('disables immediately when the backend preview reports no affected assignments', async () => {
      await setup();
      nodeAssignmentService.previewCordonsObertsImpact.mockReturnValue(of({ affectedCount: 0 }));

      component.requestCordonsOberts(INSTANCE_ID, false);

      expect(nodeAssignmentService.previewCordonsObertsImpact).toHaveBeenCalledWith(INSTANCE_ID);
      expect(nodeAssignmentService.updateCordons).toHaveBeenCalledWith(INSTANCE_ID, { cordonsObertsEnabled: false });
      expect(component.pending()).toBeNull();
    });

    it('asks for confirmation with the backend-reported count before disabling when impact > 0', async () => {
      await setup();
      nodeAssignmentService.previewCordonsObertsImpact.mockReturnValue(of({ affectedCount: 1 }));

      component.requestCordonsOberts(INSTANCE_ID, false);
      fixture.detectChanges();

      expect(nodeAssignmentService.updateCordons).not.toHaveBeenCalled();
      expect(component.pending()).toEqual({ kind: 'oberts', instanceId: INSTANCE_ID, affectedCount: 1 });
      const text = document.body.textContent ?? '';
      expect(text).toContain('Desactiva els cordons oberts');
      expect(text).toContain('1 assignació');
    });

    it('disables on confirm, emits the result and names how many were unassigned', async () => {
      await setup();
      nodeAssignmentService.previewCordonsObertsImpact.mockReturnValue(of({ affectedCount: 2 }));
      const result = { numberOfCordons: null, cordonsObertsEnabled: false, removedAssignments: 2 };
      nodeAssignmentService.updateCordons.mockReturnValue(of(result));
      let emitted: unknown;
      component.changed.subscribe((v) => (emitted = v));

      component.requestCordonsOberts(INSTANCE_ID, false);
      component.confirm();

      expect(nodeAssignmentService.updateCordons).toHaveBeenCalledWith(INSTANCE_ID, { cordonsObertsEnabled: false });
      expect(emitted).toEqual(result);
      expect(toast.warning).toHaveBeenCalledWith("S'han desassignat 2 persones dels cordons oberts.");
      expect(component.pending()).toBeNull();
    });

    it('shows an error toast and does not apply when the preview call fails', async () => {
      await setup();
      nodeAssignmentService.previewCordonsObertsImpact.mockReturnValue(throwError(() => new Error('boom')));

      component.requestCordonsOberts(INSTANCE_ID, false);

      expect(toast.error).toHaveBeenCalled();
      expect(nodeAssignmentService.updateCordons).not.toHaveBeenCalled();
    });
  });
});
