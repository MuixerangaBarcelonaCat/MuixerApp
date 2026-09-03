import { ComponentFixture, TestBed } from '@angular/core/testing';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NodeActionsComponent } from './node-actions.component';

describe('NodeActionsComponent', () => {
  let fixture: ComponentFixture<NodeActionsComponent>;
  let component: NodeActionsComponent;
  let el: HTMLElement;

  const renderWith = async (
    canDuplicate: boolean,
    canGhost: boolean,
    canDelete = canDuplicate,
  ): Promise<void> => {
    fixture.componentRef.setInput('canDuplicate', canDuplicate);
    fixture.componentRef.setInput('canDelete', canDelete);
    fixture.componentRef.setInput('canGhost', canGhost);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NodeActionsComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(NodeActionsComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  // Each action is a lib-button (display:contents host) — data-testid lands on that inert host,
  // so queries scope to the real inner <button>, same pattern as modal.component's own spec.
  const duplicateButton = () => el.querySelector<HTMLButtonElement>('[data-testid="node-action-duplicate"] button')!;
  const ghostButton = () => el.querySelector<HTMLButtonElement>('[data-testid="node-action-ghost"] button')!;
  const deleteButton = () => el.querySelector<HTMLButtonElement>('[data-testid="node-action-delete"] button')!;

  describe('button visibility and disabled state', () => {
    it('renders all three buttons', async () => {
      await renderWith(false, false);
      expect(duplicateButton()).toBeTruthy();
      expect(ghostButton()).toBeTruthy();
      expect(deleteButton()).toBeTruthy();
    });

    it('disables duplicate button when canDuplicate is false', async () => {
      await renderWith(false, false);
      expect(duplicateButton().disabled).toBe(true);
    });

    it('enables duplicate button when canDuplicate is true', async () => {
      await renderWith(true, false);
      expect(duplicateButton().disabled).toBe(false);
    });

    it('disables ghost button when canGhost is false', async () => {
      await renderWith(true, false);
      expect(ghostButton().disabled).toBe(true);
    });

    it('enables ghost button when canGhost is true', async () => {
      await renderWith(true, true);
      expect(ghostButton().disabled).toBe(false);
    });

    it('disables delete button when canDelete is false', async () => {
      await renderWith(false, false, false);
      expect(deleteButton().disabled).toBe(true);
    });

    it('enables delete button independently of canDuplicate', async () => {
      await renderWith(false, false, true);
      expect(deleteButton().disabled).toBe(false);
    });
  });

  describe('output emissions', () => {
    beforeEach(async () => {
      await renderWith(true, true);
    });

    it('emits duplicate when duplicate button clicked', () => {
      let emitted = false;
      component.duplicate.subscribe(() => (emitted = true));

      duplicateButton().click();
      expect(emitted).toBe(true);
    });

    it('emits ghost when ghost button clicked', () => {
      let emitted = false;
      component.ghost.subscribe(() => (emitted = true));

      ghostButton().click();
      expect(emitted).toBe(true);
    });

    it('emits nodeDeleted when delete button clicked', () => {
      let emitted = false;
      component.nodeDeleted.subscribe(() => (emitted = true));

      deleteButton().click();
      expect(emitted).toBe(true);
    });
  });

  describe('disabled ghost tooltip', () => {
    it('shows restricted tooltip when canGhost is false', async () => {
      await renderWith(true, false);
      expect(ghostButton().getAttribute('aria-label')).toContain('PINYA');
    });

    it('shows generic tooltip when canGhost is true', async () => {
      await renderWith(true, true);
      expect(ghostButton().getAttribute('aria-label')).not.toContain('PINYA');
    });
  });

  describe('accessibility', () => {
    it('has role=toolbar on the container', async () => {
      await renderWith(true, true);
      const toolbar = el.querySelector('[role="toolbar"]');
      expect(toolbar).toBeTruthy();
    });

    it('each button has an aria-label', async () => {
      await renderWith(true, true);
      const buttons = el.querySelectorAll<HTMLButtonElement>('button');
      for (const btn of Array.from(buttons)) {
        expect(btn.getAttribute('aria-label')).toBeTruthy();
      }
    });
  });
});
