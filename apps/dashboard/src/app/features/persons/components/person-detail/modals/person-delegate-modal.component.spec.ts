import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DelegateType } from '@muixer/shared';
import { PersonDelegateModalComponent } from './person-delegate-modal.component';
import { PersonDelegateService } from '../../../services/person-delegate.service';
import { UserService } from '../../../../config/services/user.service';
import { ComponentRef } from '@angular/core';

describe('PersonDelegateModalComponent', () => {
  let fixture: ComponentFixture<PersonDelegateModalComponent>;
  let component: PersonDelegateModalComponent;
  let componentRef: ComponentRef<PersonDelegateModalComponent>;
  let mockDelegateService: { createDelegate: ReturnType<typeof vi.fn> };
  let mockUserService: { getAll: ReturnType<typeof vi.fn> };

  const mockUsers = {
    data: [
      { id: 'u1', email: 'user1@test.com', role: 'MEMBER', isActive: true, person: { id: 'p-u1', alias: 'User1' } },
      { id: 'u2', email: 'user2@test.com', role: 'TECHNICAL', isActive: true, person: null },
    ],
    total: 2,
  };

  beforeEach(async () => {
    mockDelegateService = { createDelegate: vi.fn() };
    mockUserService = { getAll: vi.fn().mockReturnValue(of(mockUsers)) };

    await TestBed.configureTestingModule({
      imports: [PersonDelegateModalComponent],
      providers: [
        { provide: PersonDelegateService, useValue: mockDelegateService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonDelegateModalComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('personId', 'person-1');
    componentRef.setInput('existingDelegateUserIds', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the secondary-manager title by default', () => {
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('Afegeix un altre delegat');
  });

  it('renders the primary-manager title when isPrimary is set', () => {
    componentRef.setInput('isPrimary', true);
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('Vincula un delegat');
  });

  it('loads users on init and renders them', () => {
    expect(mockUserService.getAll).toHaveBeenCalled();
    const items = fixture.nativeElement.querySelectorAll('ul li');
    expect(items.length).toBe(2);
  });

  it('loads users regardless of activation status, so inactive accounts can still be linked', () => {
    const call = mockUserService.getAll.mock.calls[0][0];
    expect(call.isActive).toBeUndefined();
  });

  it('does not show a role badge for MEMBER users', () => {
    mockUserService.getAll.mockReturnValue(
      of({
        data: [{ id: 'u4', email: 'member@test.com', role: 'MEMBER', isActive: true, person: null }],
        total: 1,
      }),
    );
    component.ngOnInit();
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('ul li .badge-outline');
    expect(badges.length).toBe(0);
  });

  it('shows the role in Catalan for TECHNICAL and ADMIN users', () => {
    mockUserService.getAll.mockReturnValue(
      of({
        data: [
          { id: 'u5', email: 'tech@test.com', role: 'TECHNICAL', isActive: true, person: null },
          { id: 'u6', email: 'admin@test.com', role: 'ADMIN', isActive: true, person: null },
        ],
        total: 2,
      }),
    );
    component.ngOnInit();
    fixture.detectChanges();

    const badges = Array.from(
      fixture.nativeElement.querySelectorAll('ul li .badge-outline'),
    ).map((b) => (b as HTMLElement).textContent?.trim());
    expect(badges).toEqual(['Tècnica', 'Administrador']);
  });

  it('shows a "Pendent d\'activar" badge for an inactive user', () => {
    mockUserService.getAll.mockReturnValue(
      of({
        data: [
          { id: 'u3', email: 'inactive@test.com', role: 'MEMBER', isActive: false, person: null },
        ],
        total: 1,
      }),
    );
    component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pendent d\'activar');
  });

  it('filters out existing delegate user IDs', () => {
    componentRef.setInput('existingDelegateUserIds', ['u1']);
    component.ngOnInit();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('ul li');
    expect(items.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('user2@test.com');
    expect(fixture.nativeElement.textContent).not.toContain('user1@test.com');
  });

  it('disables save button when no user is selected', () => {
    const saveBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Afegeix',
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('enables save button when a user is selected', () => {
    component.selectUser(mockUsers.data[0] as any);
    fixture.detectChanges();
    const saveBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Afegeix',
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('calls createDelegate on save and emits saved', () => {
    const created = { id: 'del-1', delegateType: DelegateType.PARENT, user: mockUsers.data[0] };
    mockDelegateService.createDelegate.mockReturnValue(of(created));

    let emitted = false;
    component.saved.subscribe(() => (emitted = true));

    component.selectUser(mockUsers.data[0] as any);
    component.selectedType.set(DelegateType.PARENT);
    component.save();

    expect(mockDelegateService.createDelegate).toHaveBeenCalledWith('person-1', {
      userId: 'u1',
      delegateType: DelegateType.PARENT,
      isPrimary: false,
    });
    expect(emitted).toBe(true);
  });

  it('passes isPrimary: true to createDelegate when the isPrimary input is set', () => {
    componentRef.setInput('isPrimary', true);
    const created = { id: 'del-1', delegateType: DelegateType.PARENT, user: mockUsers.data[0] };
    mockDelegateService.createDelegate.mockReturnValue(of(created));

    component.selectUser(mockUsers.data[0] as any);
    component.save();

    expect(mockDelegateService.createDelegate).toHaveBeenCalledWith('person-1', {
      userId: 'u1',
      delegateType: DelegateType.PARENT,
      isPrimary: true,
    });
  });

  it('shows error message on save failure', () => {
    mockDelegateService.createDelegate.mockReturnValue(
      throwError(() => ({ error: { message: 'Duplicate' } })),
    );

    component.selectUser(mockUsers.data[0] as any);
    component.save();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Duplicate');
  });

  it('emits closed when close is called', () => {
    let emitted = false;
    component.closed.subscribe(() => (emitted = true));
    component.close();
    expect(emitted).toBe(true);
  });

  it('defaults to PARENT delegate type', () => {
    expect(component.selectedType()).toBe(DelegateType.PARENT);
  });

  it('renders all four delegate type options by default', () => {
    const options = fixture.nativeElement.querySelectorAll('#delegate-type option');
    const labels = Array.from(options).map((o) => (o as HTMLOptionElement).textContent?.trim());
    expect(labels).toEqual(['Pare/Mare', 'Parella', 'Tutor/a', 'Altres']);
  });

  it('restricts type options to PARENT/GUARDIAN when isXicalla and isPrimary are both set', () => {
    componentRef.setInput('isPrimary', true);
    componentRef.setInput('isXicalla', true);
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('#delegate-type option');
    const labels = Array.from(options).map((o) => (o as HTMLOptionElement).textContent?.trim());
    expect(labels).toEqual(['Pare/Mare', 'Tutor/a']);
  });

  it('does not restrict type options for a Xicalla secondary manager (isPrimary false)', () => {
    componentRef.setInput('isPrimary', false);
    componentRef.setInput('isXicalla', true);
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('#delegate-type option');
    expect(options.length).toBe(4);
  });
});
