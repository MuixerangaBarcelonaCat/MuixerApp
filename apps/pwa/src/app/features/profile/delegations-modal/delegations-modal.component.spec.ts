import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { DelegateType } from '@muixer/shared';
import { DelegationsModalComponent } from './delegations-modal.component';
import { ProfileDelegate, ProfileService } from '../services/profile.service';
import { ToastService } from '../../../shared/services/toast.service';

const PRIMARY_DELEGATE: ProfileDelegate = {
  id: 'd-1',
  delegateType: DelegateType.PARENT,
  isActive: true,
  isPrimary: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  user: { id: 'u-2', email: 'mare@a.com', person: { id: 'p-2', alias: 'Mare' } },
  person: { id: 'p-1', alias: 'Xicalla1' },
};

const SECONDARY_DELEGATE: ProfileDelegate = {
  id: 'd-2',
  delegateType: DelegateType.OTHER,
  isActive: true,
  isPrimary: false,
  createdAt: '2026-01-02T00:00:00.000Z',
  user: { id: 'u-3', email: 'oncle@a.com', person: null },
  person: { id: 'p-1', alias: 'Xicalla1' },
};

function setInputValue(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input'));
}

function createTestBed(delegates: ProfileDelegate[] | Subject<ProfileDelegate[]> = []) {
  const profileService = {
    listDelegates: vi
      .fn()
      .mockReturnValue(delegates instanceof Subject ? delegates.asObservable() : of(delegates)),
    addDelegate: vi.fn(),
    removeDelegate: vi.fn().mockReturnValue(of(undefined)),
  };
  const toastService = {
    success: vi.fn(),
    error: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [DelegationsModalComponent],
    providers: [
      { provide: ProfileService, useValue: profileService },
      { provide: ToastService, useValue: toastService },
    ],
  });

  return { profileService, toastService };
}

async function stableFixture(fixture: ComponentFixture<DelegationsModalComponent>): Promise<void> {
  fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  fixture.detectChanges();
}

describe('DelegationsModalComponent', () => {
  let fixture: ComponentFixture<DelegationsModalComponent>;

  describe('list', () => {
    it('shows a loading state while delegates are loading', async () => {
      createTestBed(new Subject<ProfileDelegate[]>());
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(DelegationsModalComponent);
      fixture.componentRef.setInput('personId', 'p-1');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.loading')).toBeTruthy();
    });

    it('renders each delegate with its alias and Catalan relationship label', async () => {
      createTestBed([PRIMARY_DELEGATE, SECONDARY_DELEGATE]);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(DelegationsModalComponent);
      fixture.componentRef.setInput('personId', 'p-1');
      await stableFixture(fixture);

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Mare');
      expect(text).toContain('Pare/Mare');
      expect(text).toContain('oncle@a.com');
      expect(text).toContain('Altres');
    });

    it('shows a primary badge only for the primary delegate', async () => {
      createTestBed([PRIMARY_DELEGATE, SECONDARY_DELEGATE]);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(DelegationsModalComponent);
      fixture.componentRef.setInput('personId', 'p-1');
      await stableFixture(fixture);

      const badges = fixture.nativeElement.querySelectorAll('[data-testid="primary-badge"]');
      expect(badges.length).toBe(1);
    });

    it('does not show a remove button for the primary delegate', async () => {
      createTestBed([PRIMARY_DELEGATE, SECONDARY_DELEGATE]);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(DelegationsModalComponent);
      fixture.componentRef.setInput('personId', 'p-1');
      await stableFixture(fixture);

      const removeButtons = fixture.nativeElement.querySelectorAll(
        '[data-testid="remove-delegate"]',
      );
      expect(removeButtons.length).toBe(1);
    });

    it('shows an empty state when there are no delegates', async () => {
      createTestBed([]);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(DelegationsModalComponent);
      fixture.componentRef.setInput('personId', 'p-1');
      await stableFixture(fixture);

      expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    });
  });

  describe('dismissal', () => {
    let closed: boolean;

    beforeEach(async () => {
      createTestBed([]);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(DelegationsModalComponent);
      fixture.componentRef.setInput('personId', 'p-1');
      closed = false;
      fixture.componentInstance.closed.subscribe(() => (closed = true));
      await stableFixture(fixture);
    });

    it('emits closed when the close button is clicked', () => {
      (fixture.nativeElement.querySelector('[aria-label="Tancar"]') as HTMLButtonElement).click();
      expect(closed).toBe(true);
    });

    it('emits closed when the backdrop is clicked', () => {
      const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
      dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(closed).toBe(true);
    });

    it('does not emit closed when the modal content itself is clicked', () => {
      const box = fixture.nativeElement.querySelector('.modal-box') as HTMLElement;
      box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(closed).toBe(false);
    });

    it('emits closed on Escape', () => {
      const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(closed).toBe(true);
    });
  });

  describe('add delegate', () => {
    let profileService: ReturnType<typeof createTestBed>['profileService'];
    let toastService: ReturnType<typeof createTestBed>['toastService'];

    beforeEach(async () => {
      ({ profileService, toastService } = createTestBed([]));
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(DelegationsModalComponent);
      fixture.componentRef.setInput('personId', 'p-1');
      await stableFixture(fixture);
    });

    function fillForm(alias: string, delegateType: DelegateType): void {
      setInputValue(fixture.nativeElement.querySelector('#delegate-alias'), alias);
      (fixture.nativeElement.querySelector('#delegate-type') as HTMLSelectElement).value =
        delegateType;
      fixture.nativeElement
        .querySelector('#delegate-type')
        .dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    function submit(): void {
      (fixture.nativeElement.querySelector('#add-delegate-form') as HTMLFormElement).requestSubmit();
      fixture.detectChanges();
    }

    it('disables submit while the alias is empty', () => {
      const submitButton = fixture.nativeElement.querySelector(
        '#add-delegate-form button[type="submit"]',
      ) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
    });

    it('has no relationship type selected by default', () => {
      const select = fixture.nativeElement.querySelector('#delegate-type') as HTMLSelectElement;
      expect(select.value).toBe('');
    });

    it('disables submit until a relationship type is selected', () => {
      setInputValue(fixture.nativeElement.querySelector('#delegate-alias'), 'Oncle');
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector(
        '#add-delegate-form button[type="submit"]',
      ) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
    });

    it('calls addDelegate, resets the form, and reloads the list without a success toast', async () => {
      profileService.addDelegate.mockReturnValue(of(SECONDARY_DELEGATE));

      fillForm('Oncle', DelegateType.OTHER);
      submit();
      await stableFixture(fixture);

      expect(profileService.addDelegate).toHaveBeenCalledWith('p-1', {
        alias: 'Oncle',
        delegateType: DelegateType.OTHER,
      });
      expect(toastService.success).not.toHaveBeenCalled();
      expect(profileService.listDelegates).toHaveBeenCalledTimes(2);
      expect(
        (fixture.nativeElement.querySelector('#delegate-alias') as HTMLInputElement).value,
      ).toBe('');
    });

    it('shows an inline error for an unknown alias (404)', () => {
      profileService.addDelegate.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404 })),
      );

      fillForm('Ningú', DelegateType.OTHER);
      submit();

      expect(fixture.nativeElement.textContent).toContain(
        'No existeix cap compte associat a aquest àlies.',
      );
    });

    it('shows an inline error when the person is already a delegate (409)', () => {
      profileService.addDelegate.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409 })),
      );

      fillForm('Mare', DelegateType.PARENT);
      submit();

      expect(fixture.nativeElement.textContent).toContain(
        'Aquesta persona ja té una delegació activa amb aquest compte.',
      );
    });
  });

  describe('remove delegate', () => {
    let profileService: ReturnType<typeof createTestBed>['profileService'];
    let toastService: ReturnType<typeof createTestBed>['toastService'];

    beforeEach(async () => {
      ({ profileService, toastService } = createTestBed([SECONDARY_DELEGATE]));
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(DelegationsModalComponent);
      fixture.componentRef.setInput('personId', 'p-1');
      await stableFixture(fixture);
    });

    it('asks for confirmation before removing', () => {
      (fixture.nativeElement.querySelector('[data-testid="remove-delegate"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(profileService.removeDelegate).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[data-testid="confirm-remove"]')).toBeTruthy();
    });

    it('removes the delegate after confirming and reloads the list without a success toast', async () => {
      (fixture.nativeElement.querySelector('[data-testid="remove-delegate"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[data-testid="confirm-remove"]') as HTMLButtonElement).click();
      await stableFixture(fixture);

      expect(profileService.removeDelegate).toHaveBeenCalledWith('p-1', 'd-2');
      expect(toastService.success).not.toHaveBeenCalled();
      expect(profileService.listDelegates).toHaveBeenCalledTimes(2);
    });

    it('cancels the removal without calling removeDelegate', () => {
      (fixture.nativeElement.querySelector('[data-testid="remove-delegate"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[data-testid="cancel-remove"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(profileService.removeDelegate).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[data-testid="confirm-remove"]')).toBeFalsy();
    });
  });
});
