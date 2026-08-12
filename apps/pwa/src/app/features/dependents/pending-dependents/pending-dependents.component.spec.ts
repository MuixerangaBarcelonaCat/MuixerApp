import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Gender, PendingDependent } from '@muixer/shared';
import { PendingDependentsComponent } from './pending-dependents.component';
import { DependentsService } from '../../../core/services/dependents.service';

const child1: PendingDependent = {
  personId: 'child-1',
  alias: 'xicalla1',
  name: 'Provisional',
  firstSurname: '',
  secondSurname: null,
  gender: null,
  phone: null,
  birthDate: null,
};

const child2: PendingDependent = {
  personId: 'child-2',
  alias: 'xicalla2',
  name: 'Provisional2',
  firstSurname: '',
  secondSurname: null,
  gender: null,
  phone: null,
  birthDate: null,
};

describe('PendingDependentsComponent', () => {
  let fixture: ComponentFixture<PendingDependentsComponent>;
  let component: PendingDependentsComponent;
  let dependentsService: {
    getPending: ReturnType<typeof vi.fn>;
    completePending: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const setup = async (pending: PendingDependent[]) => {
    dependentsService = {
      getPending: vi.fn().mockReturnValue(of(pending)),
      completePending: vi.fn().mockReturnValue(of(void 0)),
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PendingDependentsComponent],
      providers: [
        { provide: DependentsService, useValue: dependentsService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PendingDependentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('shows a progress indicator and the first pending dependent', async () => {
    await setup([child1, child2]);

    expect(fixture.nativeElement.textContent).toContain('1');
    expect(fixture.nativeElement.textContent).toContain('2');
    expect(component.current()?.personId).toBe('child-1');
  });

  it('navigates to /home immediately when there are no pending dependents', async () => {
    await setup([]);

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('requires the form to be filled before submitting', async () => {
    await setup([child1]);

    component.onSubmit();

    expect(dependentsService.completePending).not.toHaveBeenCalled();
  });

  it('submits the current dependent, re-fetches, and advances to the next one', async () => {
    await setup([child1, child2]);
    dependentsService.getPending.mockReturnValue(of([child2]));

    component.form.patchValue({
      name: 'Xicalla',
      firstSurname: 'Completa',
      gender: Gender.FEMALE,
      country: 'ES',
      phoneNumber: '612345678',
      birthDate: '2016-03-10',
    });
    component.onSubmit();
    fixture.detectChanges();

    expect(dependentsService.completePending).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'child-1', name: 'Xicalla', phone: '+34612345678' }),
    );
    expect(component.current()?.personId).toBe('child-2');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates to /home once the re-fetched list is empty', async () => {
    await setup([child1]);
    dependentsService.getPending.mockReturnValue(of([]));

    component.form.patchValue({
      name: 'Xicalla',
      firstSurname: 'Completa',
      gender: Gender.FEMALE,
      country: 'ES',
      phoneNumber: '612345678',
      birthDate: '2016-03-10',
    });
    component.onSubmit();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('shows a server error without losing the remaining queue', async () => {
    await setup([child1, child2]);
    dependentsService.completePending.mockReturnValue(
      throwError(() => ({ error: { message: 'Error inesperat' } })),
    );

    component.form.patchValue({
      name: 'Xicalla',
      firstSurname: 'Completa',
      gender: Gender.FEMALE,
      country: 'ES',
      phoneNumber: '612345678',
      birthDate: '2016-03-10',
    });
    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Error inesperat');
    expect(component.current()?.personId).toBe('child-1');
  });
});
