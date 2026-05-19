import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Layers,
  PlusCircle,
  UserCheck,
  HelpCircle,
  X,
} from 'lucide-angular';
import { PinyesOnboardingModalComponent } from './pinyes-onboarding-modal.component';

const STORAGE_KEY = 'muixer_pinyes_onboarding_dismissed';

describe('PinyesOnboardingModalComponent', () => {
  let fixture: ComponentFixture<PinyesOnboardingModalComponent>;
  let component: PinyesOnboardingModalComponent;

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY);

    await TestBed.configureTestingModule({
      imports: [PinyesOnboardingModalComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useFactory: () =>
            new LucideIconProvider({ Layers, PlusCircle, UserCheck, HelpCircle, X }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PinyesOnboardingModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('shows modal on first visit (no localStorage key)', () => {
    expect(component.visible()).toBe(true);
  });

  it('does not show modal when dismissed via localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');

    const fixture2 = TestBed.createComponent(PinyesOnboardingModalComponent);
    const comp2 = fixture2.componentInstance;
    fixture2.detectChanges();

    expect(comp2.visible()).toBe(false);
  });

  it('has 3 steps', () => {
    expect(component.steps).toHaveLength(3);
  });

  it('starts at step 0', () => {
    expect(component.currentStep()).toBe(0);
  });

  it('navigates forward with nextStep()', () => {
    component.nextStep();
    expect(component.currentStep()).toBe(1);
    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });

  it('does not go beyond last step', () => {
    component.nextStep();
    component.nextStep();
    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });

  it('navigates backward with prevStep()', () => {
    component.nextStep();
    component.prevStep();
    expect(component.currentStep()).toBe(0);
  });

  it('does not go below step 0', () => {
    component.prevStep();
    expect(component.currentStep()).toBe(0);
  });

  it('close() hides the modal', () => {
    component.close();
    expect(component.visible()).toBe(false);
  });

  it('close() with dontShowAgain saves to localStorage', () => {
    component.toggleDontShowAgain();
    component.close();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('close() without dontShowAgain does not save to localStorage', () => {
    component.close();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('open() resets to step 0 and shows modal', () => {
    component.nextStep();
    component.close();
    component.open();
    expect(component.visible()).toBe(true);
    expect(component.currentStep()).toBe(0);
  });

  it('emits closed output on close', () => {
    const spy = vi.fn();
    component.closed.subscribe(spy);
    component.close();
    expect(spy).toHaveBeenCalled();
  });
});
