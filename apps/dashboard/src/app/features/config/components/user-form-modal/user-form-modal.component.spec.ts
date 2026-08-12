import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { UserRole } from '@muixer/shared';
import { UserFormModalComponent } from './user-form-modal.component';
import { UserService } from '../../services/user.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { UserDto } from '../../models/user.model';

const mockUser = (overrides: Partial<UserDto> = {}): UserDto => ({
  id: 'u1',
  email: 'test@example.com',
  role: UserRole.TECHNICAL,
  isActive: true,
  inviteExpiresAt: null,
  person: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  ...overrides,
});

describe('UserFormModalComponent', () => {
  let fixture: ComponentFixture<UserFormModalComponent>;
  let component: UserFormModalComponent;
  let userService: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    userService = {
      create: vi.fn().mockReturnValue(of(mockUser())),
      update: vi.fn().mockReturnValue(of(mockUser())),
    };

    await TestBed.configureTestingModule({
      imports: [UserFormModalComponent],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: AuthService,
          useValue: { userRole: signal<UserRole | null>(UserRole.ADMIN) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserFormModalComponent);
    component = fixture.componentInstance;
  });

  describe('role field visibility', () => {
    it('shows the role field when creating a user', () => {
      fixture.detectChanges();
      expect(component.showRoleField()).toBe(true);
      expect(fixture.nativeElement.querySelector('fieldset')).toBeTruthy();
    });

    it('hides the role field entirely when editing a user (role changes go through "Assignar rol")', () => {
      fixture.componentRef.setInput('user', mockUser({ role: UserRole.ADMIN }));
      fixture.detectChanges();
      expect(component.showRoleField()).toBe(false);
      expect(fixture.nativeElement.querySelector('fieldset')).toBeFalsy();
      expect(fixture.nativeElement.textContent).not.toContain('Rol');
    });
  });

  describe('onSave in edit mode', () => {
    it('never sends a role change, even though the form control still carries the original role', () => {
      const editUser = mockUser({ role: UserRole.ADMIN });
      fixture.componentRef.setInput('user', editUser);
      fixture.detectChanges();

      component.form.patchValue({ email: 'new@example.com' });
      component.onSave();

      expect(userService.update).toHaveBeenCalledWith(
        'u1',
        expect.not.objectContaining({ role: expect.anything() }),
      );
    });
  });
});
