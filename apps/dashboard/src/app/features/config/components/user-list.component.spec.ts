import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { allLucideIconsProvider } from '../../../../testing/lucide-test-provider';
import { UserListComponent } from './user-list.component';
import { UserService } from '../services/user.service';
import { ToastService } from '@muixer/ui';
import { AuthService } from '../../../core/auth/services/auth.service';
import { PersonService } from '../../../features/persons/services/person.service';
import { UserRole } from '@muixer/shared';
import { UserDto } from '../models/user.model';

const mockUser = (overrides: Partial<UserDto> = {}): UserDto => ({
  id: 'u1',
  email: 'test@example.com',
  role: UserRole.MEMBER,
  isActive: true,
  inviteExpiresAt: null,
  person: {
    id: 'p1',
    alias: 'tester',
    name: 'Test',
    firstSurname: 'User',
    secondSurname: null,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  ...overrides,
});

const mockResponse = (data: UserDto[] = [mockUser()], total = 1) => ({
  data,
  total,
});

describe('UserListComponent', () => {
  let fixture: ComponentFixture<UserListComponent>;
  let component: UserListComponent;
  let userRoleSignal: ReturnType<typeof signal<UserRole | null>>;
  let userService: {
    getAll: ReturnType<typeof vi.fn>;
    grantRole: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
  };
  let toastService: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    userService = {
      getAll: vi.fn().mockReturnValue(of(mockResponse())),
      grantRole: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    };

    toastService = {
      success: vi.fn(),
      error: vi.fn(),
    };
    const mockToast = toastService;

    const mockPersonService = {
      getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 10 } })),
    };

    const mockAuthService = {
      userRole: (userRoleSignal = signal<UserRole | null>(UserRole.ADMIN)),
      currentUser: vi.fn().mockReturnValue({ role: UserRole.ADMIN }),
    };

    await TestBed.configureTestingModule({
      imports: [UserListComponent],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: ToastService, useValue: mockToast },
        { provide: PersonService, useValue: mockPersonService },
        { provide: AuthService, useValue: mockAuthService },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    localStorage.clear();
    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates and loads users on init', () => {
    expect(component).toBeTruthy();
    expect(userService.getAll).toHaveBeenCalledTimes(1);
    expect(component.users()).toHaveLength(1);
    expect(component.totalUsers()).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  describe('role filter', () => {
    beforeEach(() => {
      component.activeFilters.set({});
      vi.clearAllMocks();
      userService.getAll.mockReturnValue(of(mockResponse()));
    });

    it('adds role to filter array and reloads', () => {
      component.toggleRoleFilter(UserRole.ADMIN);
      expect(component.activeFilters().role).toEqual([UserRole.ADMIN]);
      expect(userService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ role: [UserRole.ADMIN] }),
      );
    });

    it('clears role filter when toggling the only active role', () => {
      component.toggleRoleFilter(UserRole.ADMIN);
      component.toggleRoleFilter(UserRole.ADMIN);
      expect(component.activeFilters().role).toBeUndefined();
    });

    it('accumulates multiple roles in the filter array', () => {
      component.toggleRoleFilter(UserRole.ADMIN);
      component.toggleRoleFilter(UserRole.MEMBER);
      expect(component.activeFilters().role).toEqual([UserRole.ADMIN, UserRole.MEMBER]);
    });
  });

  describe('isActive filter', () => {
    beforeEach(() => {
      component.activeFilters.set({});
      vi.clearAllMocks();
      userService.getAll.mockReturnValue(of(mockResponse()));
    });

    it('sets isActive=true and reloads', () => {
      component.toggleActiusFilter();
      expect(component.activeFilters().isActive).toBe(true);
      expect(userService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });

    it('clears isActive on second toggle', () => {
      component.toggleActiusFilter();
      component.toggleActiusFilter();
      expect(component.activeFilters().isActive).toBeUndefined();
    });
  });

  describe('search filter', () => {
    it('debounces and reloads with search term', async () => {
      vi.useFakeTimers();
      component.onSearchChange('john');
      vi.advanceTimersByTime(300);
      expect(component.search()).toBe('john');
      expect(userService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'john' }),
      );
      vi.useRealTimers();
    });
  });

  describe('clearFilters', () => {
    it('resets all filters and reloads', () => {
      component.toggleRoleFilter(UserRole.ADMIN);
      component.toggleActiusFilter();
      component.clearFilters();
      expect(component.activeFilters()).toEqual({});
      expect(component.search()).toBe('');
      expect(component.searchInput).toBe('');
      expect(component.page()).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Active filter chips
  // ---------------------------------------------------------------------------

  describe('activeFilterChips', () => {
    beforeEach(() => {
      component.activeFilters.set({});
      component.search.set('');
    });

    it('is empty with no filters', () => {
      expect(component.activeFilterChips()).toHaveLength(0);
    });

    it('shows search chip', () => {
      component.search.set('joan');
      expect(
        component.activeFilterChips().some((c) => c.key === 'search'),
      ).toBe(true);
    });

    it('shows role chip with label', () => {
      component.activeFilters.set({ role: [UserRole.ADMIN] });
      const chip = component.activeFilterChips().find((c) => c.key === 'role');
      expect(chip).toBeDefined();
      expect(chip!.label).toContain('Administrador');
    });

    it('shows isActive chip', () => {
      component.activeFilters.set({ isActive: true });
      expect(
        component.activeFilterChips().some((c) => c.key === 'isActive'),
      ).toBe(true);
    });
  });

  describe('onRemoveFilterChip', () => {
    it('clears search chip', () => {
      component.search.set('joan');
      component.onRemoveFilterChip('search');
      expect(component.search()).toBe('');
    });

    it('clears role chip', () => {
      component.activeFilters.set({ role: [UserRole.ADMIN] });
      component.onRemoveFilterChip('role');
      expect(component.activeFilters().role).toBeUndefined();
    });

    it('clears isActive chip', () => {
      component.activeFilters.set({ isActive: true });
      component.onRemoveFilterChip('isActive');
      expect(component.activeFilters().isActive).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------

  describe('onSortColumn', () => {
    it('sets ASC on first click', () => {
      const col = {
        key: 'email',
        label: 'Correu',
        defaultVisible: true,
        sortField: 'email',
      };
      component.onSortColumn(col);
      expect(component.sortBy()).toBe('email');
      expect(component.sortOrder()).toBe('ASC');
      expect(userService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'email', sortOrder: 'ASC' }),
      );
    });

    it('toggles to DESC on second click of same column', () => {
      const col = {
        key: 'email',
        label: 'Correu',
        defaultVisible: true,
        sortField: 'email',
      };
      component.onSortColumn(col);
      component.onSortColumn(col);
      expect(component.sortOrder()).toBe('DESC');
    });

    it('clears sort on third click', () => {
      const col = {
        key: 'email',
        label: 'Correu',
        defaultVisible: true,
        sortField: 'email',
      };
      component.onSortColumn(col);
      component.onSortColumn(col);
      component.onSortColumn(col);
      expect(component.sortBy()).toBeUndefined();
      expect(component.sortOrder()).toBeUndefined();
    });

    it('ignores columns without sortField', () => {
      const callsBefore = userService.getAll.mock.calls.length;
      component.onSortColumn({
        key: 'person',
      });
      expect(userService.getAll.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('onSortChangeFromTable', () => {
    it('applies sort from table event', () => {
      component.onSortChangeFromTable({ field: 'role', order: 'DESC' });
      expect(component.sortBy()).toBe('role');
      expect(component.sortOrder()).toBe('DESC');
      expect(userService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'role', sortOrder: 'DESC' }),
      );
    });

    it('clears sort when order is undefined', () => {
      component.onSortChangeFromTable({ field: 'role', order: undefined });
      expect(component.sortBy()).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  describe('pagination', () => {
    it('totalPages is computed correctly', () => {
      component.totalUsers.set(60);
      component.limit.set(25);
      expect(component.totalPages()).toBe(3);
    });

    it('goToPage changes page and reloads', () => {
      component.totalUsers.set(60);
      component.limit.set(25);
      component.goToPage(2);
      expect(component.page()).toBe(2);
      expect(userService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });

    it('goToPage ignores invalid page numbers', () => {
      component.totalUsers.set(60);
      component.limit.set(25);
      const callsBefore = userService.getAll.mock.calls.length;
      component.goToPage(0);
      component.goToPage(99);
      expect(userService.getAll.mock.calls.length).toBe(callsBefore);
    });

    it('onLimitChange updates limit and resets to page 1', () => {
      component.page.set(3);
      component.onLimitChange(50);
      expect(component.limit()).toBe(50);
      expect(component.page()).toBe(1);
    });

    it('onLimitChange ignores invalid values', () => {
      const callsBefore = userService.getAll.mock.calls.length;
      component.onLimitChange(77);
      expect(userService.getAll.mock.calls.length).toBe(callsBefore);
    });
  });

  // ---------------------------------------------------------------------------
  // Grant role modal
  // ---------------------------------------------------------------------------

  describe('grant role modal', () => {
    it('openGrantRole sets user and current role', () => {
      const user = mockUser({ role: UserRole.MEMBER });
      component.openGrantRole(user);
      expect(component.grantRoleUser()).toEqual(user);
      expect(component.grantRoleSelected()).toBe(UserRole.MEMBER);
    });

    it('closeGrantRole clears state', () => {
      component.openGrantRole(mockUser());
      component.closeGrantRole();
      expect(component.grantRoleUser()).toBeNull();
      expect(component.grantRoleSelected()).toBeNull();
    });

    it('confirmGrantRole does nothing if role unchanged', () => {
      const user = mockUser({ role: UserRole.MEMBER });
      component.openGrantRole(user);
      component.confirmGrantRole();
      expect(userService.grantRole).not.toHaveBeenCalled();
      expect(component.grantRoleUser()).toBeNull();
    });

    it('confirmGrantRole calls grantRole and updates list on success', () => {
      const user = mockUser({ role: UserRole.MEMBER });
      const updated = mockUser({ role: UserRole.ADMIN });
      userService.grantRole.mockReturnValue(of(updated));
      component.users.set([user]);

      component.openGrantRole(user);
      component.grantRoleSelected.set(UserRole.ADMIN);
      component.confirmGrantRole();

      expect(userService.grantRole).toHaveBeenCalledWith(
        user.id,
        UserRole.ADMIN,
      );
      expect(component.users()[0].role).toBe(UserRole.ADMIN);
      expect(component.grantRoleUser()).toBeNull();
    });

    it('confirmGrantRole closes modal on error and resets loading', () => {
      const user = mockUser({ role: UserRole.MEMBER });
      userService.grantRole.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.users.set([user]);

      component.openGrantRole(user);
      component.grantRoleSelected.set(UserRole.ADMIN);
      component.confirmGrantRole();

      expect(component.grantRoleLoading()).toBe(false);
      // modal stays open so user can retry
      expect(component.grantRoleUser()).not.toBeNull();
    });

    it('confirmGrantRole shows the backend error message in a toast', () => {
      const user = mockUser({ role: UserRole.MEMBER });
      userService.grantRole.mockReturnValue(
        throwError(() => ({ error: { message: 'No et pots canviar el teu propi rol' } })),
      );
      component.users.set([user]);

      component.openGrantRole(user);
      component.grantRoleSelected.set(UserRole.ADMIN);
      component.confirmGrantRole();

      expect(toastService.error).toHaveBeenCalledWith(
        'No et pots canviar el teu propi rol',
      );
    });

    it('confirmGrantRole falls back to a generic message when the backend gives none', () => {
      const user = mockUser({ role: UserRole.MEMBER });
      userService.grantRole.mockReturnValue(throwError(() => new Error('fail')));
      component.users.set([user]);

      component.openGrantRole(user);
      component.grantRoleSelected.set(UserRole.ADMIN);
      component.confirmGrantRole();

      expect(toastService.error).toHaveBeenCalledWith(
        'Error en assignar el rol.',
      );
    });

    it('hides assign role action for TECHNICAL actors', () => {
      userRoleSignal.set(UserRole.TECHNICAL);
      fixture.detectChanges();

      expect(
        component.tableRowActions().some((action) => action.label === 'Assignar rol'),
      ).toBe(false);
    });

    it('includes MEMBER among the assignable roles, so admin/técnica status can be revoked', () => {
      expect(component.assignableRoles()).toContain(UserRole.MEMBER);
    });

    it('allows demoting a TECHNICAL user back to MEMBER', () => {
      const user = mockUser({ role: UserRole.TECHNICAL });
      userService.grantRole.mockReturnValue(of(mockUser({ role: UserRole.MEMBER })));
      component.users.set([user]);

      component.openGrantRole(user);
      component.grantRoleSelected.set(UserRole.MEMBER);
      component.confirmGrantRole();

      expect(userService.grantRole).toHaveBeenCalledWith('u1', UserRole.MEMBER);
    });
  });

  // ---------------------------------------------------------------------------
  // Deactivate / reactivate confirmation
  // ---------------------------------------------------------------------------

  describe('status change (deactivate/activate)', () => {
    function statusAction() {
      const action = component
        .tableRowActions()
        .find((a) => typeof a.label === 'function');
      if (!action) throw new Error('status change row action not found');
      return action;
    }

    it('labels the row action "Desactivar" for an active user and "Activar" for an inactive one', () => {
      const resolveLabel = statusAction().label as (u: UserDto) => string;
      expect(resolveLabel(mockUser({ isActive: true }))).toBe('Desactivar');
      expect(resolveLabel(mockUser({ isActive: false }))).toBe('Activar');
    });

    it('clicking the row action opens a confirmation for the right direction', () => {
      const action = statusAction();
      const activeUser = mockUser({ isActive: true });
      action.action(activeUser);
      expect(component.statusChangeTarget()).toEqual({ user: activeUser, activate: false });

      component.closeStatusChangeConfirm();
      const inactiveUser = mockUser({ isActive: false });
      action.action(inactiveUser);
      expect(component.statusChangeTarget()).toEqual({ user: inactiveUser, activate: true });
    });

    it('closeStatusChangeConfirm clears the pending target', () => {
      component.openDeactivateConfirm(mockUser());
      component.closeStatusChangeConfirm();
      expect(component.statusChangeTarget()).toBeNull();
    });

    it('confirming a deactivation calls deactivate() and updates the list', () => {
      const user = mockUser({ isActive: true });
      userService.deactivate.mockReturnValue(of(undefined));
      component.users.set([user]);

      component.openDeactivateConfirm(user);
      component.confirmStatusChange();

      expect(userService.deactivate).toHaveBeenCalledWith(user.id);
      expect(component.users()[0].isActive).toBe(false);
      expect(component.statusChangeTarget()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('confirming a reactivation calls update({ isActive: true }) and updates the list', () => {
      const user = mockUser({ isActive: false });
      const updated = mockUser({ isActive: true });
      userService.update.mockReturnValue(of(updated));
      component.users.set([user]);

      component.openActivateConfirm(user);
      component.confirmStatusChange();

      expect(userService.update).toHaveBeenCalledWith(user.id, { isActive: true });
      expect(component.users()[0].isActive).toBe(true);
      expect(component.statusChangeTarget()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('keeps the dialog open and toasts on error', () => {
      const user = mockUser({ isActive: true });
      userService.deactivate.mockReturnValue(throwError(() => new Error('fail')));
      component.users.set([user]);

      component.openDeactivateConfirm(user);
      component.confirmStatusChange();

      expect(component.statusChangeLoading()).toBe(false);
      expect(component.statusChangeTarget()).not.toBeNull();
      expect(toastService.error).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Column visibility
  // ---------------------------------------------------------------------------

  describe('column visibility', () => {
    it('toggleColumn adds a hidden column', () => {
      const hidden = 'inviteExpiresAt';
      if (component.visibleColumnKeys().includes(hidden)) {
        component.toggleColumn(hidden);
      }
      component.toggleColumn(hidden);
      expect(component.visibleColumnKeys()).toContain(hidden);
    });

    it('toggleColumn removes a visible column', () => {
      const visible = 'email';
      component.visibleColumnKeys.set(['email', 'role']);
      component.toggleColumn(visible);
      expect(component.visibleColumnKeys()).not.toContain(visible);
    });
  });

  // ---------------------------------------------------------------------------
  // getCellValue
  // ---------------------------------------------------------------------------

  describe('getCellValue', () => {
    const user = mockUser();

    it('formats person as alias · name surname', () => {
      expect(component.getCellValue(user, 'person')).toBe('tester · Test User');
    });

    it('returns — for null person', () => {
      expect(component.getCellValue(mockUser({ person: null }), 'person')).toBe(
        '—',
      );
    });

    it('formats isActive=true', () => {
      expect(component.getCellValue(user, 'isActive')).toBe('Actiu');
    });

    it('formats isActive=false', () => {
      expect(
        component.getCellValue(mockUser({ isActive: false }), 'isActive'),
      ).toBe('Inactiu');
    });

    it('formats role with label', () => {
      expect(component.getCellValue(user, 'role')).toBe('Membre');
    });

    it('shows the real email for an active user', () => {
      expect(component.getCellValue(mockUser({ isActive: true, email: 'a@b.cat' }), 'email')).toBe('a@b.cat');
    });

    it('shows "Pendent d\'activar" instead of a null email for an inactive user', () => {
      expect(
        component.getCellValue(mockUser({ isActive: false, email: null }), 'email'),
      ).toBe("Pendent d'activar");
    });

    it('formats null inviteExpiresAt as —', () => {
      expect(component.getCellValue(user, 'inviteExpiresAt')).toBe('—');
    });
  });

  describe('tap targets >=24px (WI-22)', () => {
    it('gives the search input a >=24px tap target', () => {
      const search = fixture.nativeElement.querySelector('input[type="text"]') as HTMLElement;
      expect(search).toBeTruthy();
      expect(search.className).toContain('h-6');
    });
  });
});
