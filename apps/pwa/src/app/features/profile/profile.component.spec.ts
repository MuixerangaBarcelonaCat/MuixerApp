import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { DelegateType, ManagedPerson, PersonProfileSummary, UserRole } from '@muixer/shared';
import { ProfileComponent } from './profile.component';
import { ProfileService } from './services/profile.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { ToastService } from '@muixer/ui';

const SELF: ManagedPerson = { personId: 'p-1', displayName: 'Joanet', isSelf: true, delegateType: null };
const CHILD: ManagedPerson = {
  personId: 'p-2',
  displayName: 'Xicalla1',
  isSelf: false,
  delegateType: DelegateType.PARENT,
};

const SUMMARY_SELF: PersonProfileSummary = {
  personId: 'p-1',
  alias: 'Joanet',
  name: 'Joan',
  firstSurname: 'Garcia',
  delegationCount: 1,
};
const SUMMARY_CHILD: PersonProfileSummary = {
  personId: 'p-2',
  alias: 'Xicalla1',
  name: 'Xicalla',
  firstSurname: 'Petita',
  delegationCount: 0,
};

function createTestBed(
  options: {
    switchable?: ManagedPerson[];
    summaries?: Record<string, PersonProfileSummary>;
    personId?: string | null;
  } = {},
) {
  const switchable = options.switchable ?? [SELF];
  const summaries = options.summaries ?? { 'p-1': SUMMARY_SELF };
  const personId = options.personId === undefined ? 'p-1' : options.personId;

  const profileService = {
    listSwitchablePersons: vi.fn().mockReturnValue(of(switchable)),
    getPersonSummary: vi.fn((id: string) => of(summaries[id])),
    listDelegates: vi.fn().mockReturnValue(of([])),
  };

  TestBed.configureTestingModule({
    imports: [ProfileComponent],
    providers: [
      provideRouter([]),
      { provide: ProfileService, useValue: profileService },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      {
        provide: AuthService,
        useValue: {
          currentUser: () => ({
            id: 'u-1',
            email: 'a@a.com',
            role: UserRole.MEMBER,
            isActive: true,
            person: personId
              ? { id: personId, name: 'Joan', firstSurname: 'Garcia', alias: 'Joanet', email: null }
              : null,
          }),
        },
      },
    ],
  });

  return { profileService };
}

async function stableFixture(fixture: ComponentFixture<ProfileComponent>): Promise<void> {
  fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  fixture.detectChanges();
}

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;

  describe('single-person account', () => {
    let profileService: ReturnType<typeof createTestBed>['profileService'];

    beforeEach(async () => {
      ({ profileService } = createTestBed());
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(ProfileComponent);
      await stableFixture(fixture);
    });

    it('does not render the person switcher', () => {
      expect(fixture.nativeElement.querySelector('app-person-switcher')).toBeFalsy();
    });

    it('renders the alias and full name in the header', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Joanet');
      expect(text).toContain('Joan Garcia');
    });

    it('renders the delegation-count pill in singular', () => {
      expect((fixture.nativeElement.textContent as string)).toContain('1 delegació');
    });

    it('renders 3 placeholder stat tiles', () => {
      const tiles = fixture.nativeElement.querySelectorAll('[data-testid="profile-stat-placeholder"]');
      expect(tiles.length).toBe(3);
    });

    it('does not render an edit button', () => {
      expect(fixture.nativeElement.querySelector('[aria-label="Edita"]')).toBeFalsy();
    });

    it('renders a settings link in the header trailing slot', () => {
      const link = fixture.nativeElement.querySelector('a[aria-label="Configuració"]');
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('/profile/settings');
    });

    it('does not render the delegations modal before the pill is clicked', () => {
      expect(fixture.nativeElement.querySelector('app-delegations-modal')).toBeFalsy();
    });

    it('opens the delegations modal for the selected person when the pill is clicked', async () => {
      (fixture.nativeElement.querySelector('app-pill-badge button') as HTMLButtonElement).click();
      await stableFixture(fixture);

      expect(fixture.nativeElement.querySelector('app-delegations-modal')).toBeTruthy();
      expect(profileService.listDelegates).toHaveBeenCalledWith('p-1');
    });

    it('closes the delegations modal when it emits closed', async () => {
      (fixture.nativeElement.querySelector('app-pill-badge button') as HTMLButtonElement).click();
      await stableFixture(fixture);
      expect(fixture.nativeElement.querySelector('app-delegations-modal')).toBeTruthy();

      (fixture.nativeElement.querySelector('[aria-label="Tancar"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-delegations-modal')).toBeFalsy();
    });
  });

  describe('account managing dependents', () => {
    beforeEach(async () => {
      createTestBed({
        switchable: [SELF, CHILD],
        summaries: { 'p-1': SUMMARY_SELF, 'p-2': SUMMARY_CHILD },
      });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(ProfileComponent);
      await stableFixture(fixture);
    });

    it('renders the person switcher', () => {
      expect(fixture.nativeElement.querySelector('app-person-switcher')).toBeTruthy();
    });

    it('switches the header to the selected person when an option is picked', async () => {
      const options = fixture.nativeElement.querySelectorAll('app-person-switcher li button');
      (options[1] as HTMLButtonElement).click();
      await stableFixture(fixture);

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Xicalla1');
      expect(text).toContain('Xicalla Petita');
      expect(text).toContain('0 delegacions');
    });
  });

  describe('account with no linked person', () => {
    beforeEach(async () => {
      createTestBed({ switchable: [], summaries: {}, personId: null });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(ProfileComponent);
      await stableFixture(fixture);
    });

    it('does not render the person switcher', () => {
      expect(fixture.nativeElement.querySelector('app-person-switcher')).toBeFalsy();
    });

    it('shows an empty state instead of crashing', () => {
      expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    });
  });
});
