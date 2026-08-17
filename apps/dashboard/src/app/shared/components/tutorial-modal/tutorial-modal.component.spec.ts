import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../testing/lucide-test-provider';
import { TutorialModalComponent } from './tutorial-modal.component';
import { TutorialStep } from './tutorial-step.model';

const STORAGE_KEY = 'muixer_test_tutorial_dismissed';

const STEPS: TutorialStep[] = [
  { title: 'Pas u', description: 'Descripció u' },
  { title: 'Pas dos', description: 'Descripció dos' },
  { title: 'Pas tres', description: 'Descripció tres' },
];

async function setup(overrides: { storageKey?: string; heading?: string } = {}) {
  await TestBed.configureTestingModule({
    imports: [TutorialModalComponent],
    providers: [allLucideIconsProvider],
  }).compileComponents();

  const fixture = TestBed.createComponent(TutorialModalComponent);
  const component = fixture.componentInstance;
  fixture.componentRef.setInput('steps', STEPS);
  fixture.componentRef.setInput('heading', overrides.heading ?? 'Tutorial de prova');
  if (overrides.storageKey) {
    fixture.componentRef.setInput('storageKey', overrides.storageKey);
  }
  fixture.detectChanges();
  return { fixture, component };
}

describe('TutorialModalComponent', () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  describe('without a storageKey (parent-controlled)', () => {
    it('starts hidden', async () => {
      const { component } = await setup();
      expect(component.visible()).toBe(false);
    });

    it('does not render the "no tornes a mostrar" checkbox', async () => {
      const { component, fixture } = await setup();
      component.open();
      component.nextStep();
      component.nextStep();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeFalsy();
    });

    it('open() shows the modal and resets to step 0', async () => {
      const { component } = await setup();
      component.open();
      expect(component.visible()).toBe(true);
      expect(component.currentStep()).toBe(0);
    });

    it('close() never writes to localStorage', async () => {
      const { component } = await setup();
      component.open();
      component.close();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('with a storageKey (self-managed first-visit tutorial)', () => {
    it('shows the modal on first visit (no localStorage key)', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      expect(component.visible()).toBe(true);
    });

    it('does not show the modal when dismissed via localStorage', async () => {
      localStorage.setItem(STORAGE_KEY, 'true');
      const { component } = await setup({ storageKey: STORAGE_KEY });
      expect(component.visible()).toBe(false);
    });

    it('renders the "no tornes a mostrar" checkbox on the last step', async () => {
      const { component, fixture } = await setup({ storageKey: STORAGE_KEY });
      component.nextStep();
      component.nextStep();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeTruthy();
    });

    it('close() with dontShowAgain saves to localStorage', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      component.toggleDontShowAgain();
      component.close();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    });

    it('close() without dontShowAgain does not save to localStorage', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      component.close();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('shared navigation behavior', () => {
    it('renders the given heading', async () => {
      const { fixture } = await setup({ storageKey: STORAGE_KEY, heading: 'Capçalera personalitzada' });
      expect(fixture.nativeElement.textContent).toContain('Capçalera personalitzada');
    });

    it('has the given steps', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      expect(component.steps()).toHaveLength(3);
    });

    it('starts at step 0', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      expect(component.currentStep()).toBe(0);
    });

    it('navigates forward with nextStep()', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      component.nextStep();
      expect(component.currentStep()).toBe(1);
      component.nextStep();
      expect(component.currentStep()).toBe(2);
    });

    it('does not go beyond the last step', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      component.nextStep();
      component.nextStep();
      component.nextStep();
      expect(component.currentStep()).toBe(2);
    });

    it('navigates backward with prevStep()', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      component.nextStep();
      component.prevStep();
      expect(component.currentStep()).toBe(0);
    });

    it('does not go below step 0', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      component.prevStep();
      expect(component.currentStep()).toBe(0);
    });

    it('close() hides the modal', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      component.close();
      expect(component.visible()).toBe(false);
    });

    it('emits closed output on close', async () => {
      const { component } = await setup({ storageKey: STORAGE_KEY });
      const spy = vi.fn();
      component.closed.subscribe(spy);
      component.close();
      expect(spy).toHaveBeenCalled();
    });
  });
});
