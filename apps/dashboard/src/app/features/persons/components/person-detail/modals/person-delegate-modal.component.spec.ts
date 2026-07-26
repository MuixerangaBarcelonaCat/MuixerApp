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

  it('renders the modal title', () => {
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('Afegeix delegat');
  });

  it('loads users on init and renders them', () => {
    expect(mockUserService.getAll).toHaveBeenCalled();
    const items = fixture.nativeElement.querySelectorAll('ul li');
    expect(items.length).toBe(2);
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
    });
    expect(emitted).toBe(true);
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

  it('renders all three delegate type options', () => {
    const options = fixture.nativeElement.querySelectorAll('#delegate-type option');
    const labels = Array.from(options).map((o) => (o as HTMLOptionElement).textContent?.trim());
    expect(labels).toEqual(['Pare/Mare', 'Parella', 'Tutor/a']);
  });
});
