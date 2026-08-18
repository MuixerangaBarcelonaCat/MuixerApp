import { PersonAssignmentEntry } from '@muixer/pinyes-render';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DelegateType } from '@muixer/shared';
import { PersonDetailComponent } from './person-detail.component';
import { PersonService } from '../../services/person.service';
import { Person } from '../../models/person.model';
import { PersonDelegateService, PersonDelegateItem } from '../../services/person-delegate.service';
import { TagService } from '../../../config/services/tag.service';
import { NodeAssignmentService } from '../../../pinyes/services/node-assignment.service';
import { SeasonService } from '../../../events/services/season.service';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { ToastService } from '@muixer/ui';

const makePerson = (overrides: Partial<Person> = {}): Person => ({
  id: 'p1',
  name: 'N',
  firstSurname: 'S',
  secondSurname: null,
  alias: 'A',
  phone: null,
  birthDate: null,
  shoulderHeight: null,
  isXicalla: false,
  isMember: false,
  availability: 'AVAILABLE' as Person['availability'],
  onboardingStatus: 'IN_PROGRESS' as Person['onboardingStatus'],
  shirtDate: null,
  notes: null,
  notesEmoji: null,
  isActive: true,
  positions: [],
  user: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeHistoryEntry = (overrides: Partial<PersonAssignmentEntry> = {}): PersonAssignmentEntry => ({
  eventId: 'event-1',
  eventTitle: 'Diada',
  eventDate: '2026-05-10',
  eventType: 'ACTUACIO',
  segmentName: 'Bloc 1',
  instanceId: 'instance-1',
  figureName: 'Muixeranga de 5',
  figureSlug: 'muixeranga-de-5',
  nodeLabel: 'Mans',
  positionType: 'mans',
  zone: 'PINYA',
  z: 0,
  renglaPosition: null,
  ...overrides,
});

describe('PersonDetailComponent', () => {
  let fixture: ComponentFixture<PersonDetailComponent>;
  let component: PersonDetailComponent;
  let mockDelegateService: {
    getByPerson: ReturnType<typeof vi.fn>;
    removeDelegate: ReturnType<typeof vi.fn>;
    updateDelegate: ReturnType<typeof vi.fn>;
  };
  let mockPersonService: {
    getOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createInviteLink: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockDelegateService = {
      getByPerson: vi.fn().mockReturnValue(of([])),
      removeDelegate: vi.fn().mockReturnValue(of(void 0)),
      updateDelegate: vi.fn().mockReturnValue(of(null)),
    };
    mockPersonService = {
      getOne: vi.fn().mockReturnValue(of({ id: 'p1', positions: [], shoulderHeight: null })),
      update: vi.fn().mockReturnValue(of({ id: 'p1', positions: [], shoulderHeight: null })),
      createInviteLink: vi.fn().mockReturnValue(
        of({ inviteUrl: 'http://localhost:4300/activate?token=abc', expiresAt: '2026-01-01T00:00:00Z' }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [PersonDetailComponent],
      providers: [
        allLucideIconsProvider,
        { provide: PersonService, useValue: mockPersonService },
        { provide: TagService, useValue: { getAll: () => of([]) } },
        { provide: NodeAssignmentService, useValue: { getPersonHistory: () => of({ data: [], meta: { total: 0, page: 1, limit: 20 } }) } },
        { provide: SeasonService, useValue: { getAll: () => of({ data: [] }) } },
        { provide: PersonDelegateService, useValue: mockDelegateService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: 'p1' }) },
            paramMap: of(convertToParamMap({ id: 'p1' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Historial de pinyes table', () => {
    it('does not render a Zona column', () => {
      component.historyEntries.set([makeHistoryEntry()]);
      fixture.detectChanges();

      const headers = Array.from(fixture.nativeElement.querySelectorAll('th')).map(
        (th) => (th as HTMLElement).textContent?.trim(),
      );
      expect(headers).not.toContain('Zona');
    });

    it('shows the cordon number next to the position label', () => {
      component.historyEntries.set([makeHistoryEntry({ nodeLabel: 'Mans', renglaPosition: 2 })]);
      fixture.detectChanges();

      const cell = fixture.nativeElement.querySelector('tbody tr td:nth-child(5)');
      expect(cell.textContent.trim()).toBe('Mans C2');
    });

    it('shows only the label when there is no cordon', () => {
      component.historyEntries.set([makeHistoryEntry({ nodeLabel: 'Mans', renglaPosition: null })]);
      fixture.detectChanges();

      const cell = fixture.nativeElement.querySelector('tbody tr td:nth-child(5)');
      expect(cell.textContent.trim()).toBe('Mans');
    });
  });

  describe('responsive button rows (WI-06, PE-M2)', () => {
    it('lets the header row wrap instead of cutting off the header buttons on narrow viewports', () => {
      const headerRow = fixture.nativeElement.querySelector('div.space-y-4 > div.flex.items-center.gap-3') as HTMLElement;
      expect(headerRow.className).toContain('flex-wrap');
    });

    it('lets the header button group itself wrap when several buttons/messages are shown at once', () => {
      const editButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (btn) => (btn as HTMLElement).textContent?.trim() === 'Edita',
      ) as HTMLElement;
      expect(editButton.parentElement?.className).toContain('flex-wrap');
    });

    it('lets the "Informació de la colla" button row wrap instead of cutting off "Enllaça amb usuari existent"', () => {
      component.editing.set(true);
      fixture.detectChanges();
      const linkButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (btn) => (btn as HTMLElement).textContent?.trim() === 'Enllaça amb usuari existent',
      ) as HTMLElement;
      expect(linkButton.parentElement?.className).toContain('flex-wrap');
    });
  });

  describe('form field layout on mobile (WI-05, PE-M3)', () => {
    it('stacks every label above its input below `sm` instead of squeezing long labels next to the field', () => {
      component.editing.set(true);
      fixture.detectChanges();

      const labels = Array.from(fixture.nativeElement.querySelectorAll('label.label')) as HTMLElement[];
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.className).toContain('flex-col');
        expect(label.className).toContain('sm:flex-row');
      }
    });
  });

  describe('tap targets >=24px (WI-03, PE-L2)', () => {
    it('gives each position tag toggle a >=24px tap target', () => {
      component.editing.set(true);
      component.allPositions.set([
        { id: 'pos-1', name: 'Novatos', slug: 'novatos', shortDescription: null, longDescription: null, color: '#888', positionTypes: [], personCount: 0 },
      ]);
      fixture.detectChanges();

      const tagButton = fixture.nativeElement.querySelector('[role="group"] button.badge') as HTMLElement;
      expect(tagButton).toBeTruthy();
      expect(tagButton.className).toContain('min-h-6');
    });

    it('uses the default (24px) toggle size for Actiu/Membre/Xicalla instead of the smaller toggle-sm', () => {
      component.editing.set(true);
      fixture.detectChanges();

      const toggles = Array.from(fixture.nativeElement.querySelectorAll('input[type="checkbox"].toggle')) as HTMLElement[];
      expect(toggles.length).toBe(3);
      for (const toggle of toggles) {
        expect(toggle.className).not.toContain('toggle-sm');
      }
    });
  });

  describe('"/persons/new" fall-through (WI-23)', () => {
    it('does not fetch a person or history for the literal id "new" (no dedicated create route exists)', async () => {
      const getOne = vi.fn().mockReturnValue(of({ id: 'new', positions: [] }));
      const getPersonHistory = vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 20 } }));

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [PersonDetailComponent],
        providers: [
          allLucideIconsProvider,
          { provide: PersonService, useValue: { getOne } },
          { provide: TagService, useValue: { getAll: () => of([]) } },
          { provide: NodeAssignmentService, useValue: { getPersonHistory } },
          { provide: SeasonService, useValue: { getAll: () => of({ data: [] }) } },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: convertToParamMap({ id: 'new' }) },
              paramMap: of(convertToParamMap({ id: 'new' })),
            },
          },
        ],
      }).compileComponents();

      const newFixture = TestBed.createComponent(PersonDetailComponent);
      newFixture.detectChanges();

      expect(getOne).not.toHaveBeenCalled();
      expect(getPersonHistory).not.toHaveBeenCalled();
    });
  });

  describe('Manager section', () => {
    const makeDelegateItem = (overrides: Partial<PersonDelegateItem> = {}): PersonDelegateItem => ({
      id: 'del-1',
      delegateType: DelegateType.PARENT,
      isActive: true,
      isPrimary: true,
      createdAt: '2026-07-01T00:00:00Z',
      user: { id: 'user-1', email: 'parent@test.com', person: null },
      person: { id: 'p1', alias: 'child' },
      ...overrides,
    });

    it('shows invite/link buttons when the person has no manager', () => {
      component.delegates.set([]);
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain("Crea enllaç d'invitació");
      expect(text).toContain('Enllaça amb usuari existent');
    });

    it('still shows invite/link buttons when there are secondary delegates but no responsable', () => {
      component.delegates.set([
        makeDelegateItem({ id: 'del-2', isPrimary: false, delegateType: DelegateType.OTHER, user: { id: 'u2', email: 'aunt@test.com', person: null } }),
      ]);
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain("Crea enllaç d'invitació");
      expect(text).toContain('Enllaça amb usuari existent');
      expect(text).toContain('Delegacions');
    });

    it('disables "Crea enllaç d\'invitació" for a xicalla, with an explanatory tooltip', () => {
      component.person.set(makePerson({ isXicalla: true }));
      component.delegates.set([]);
      fixture.detectChanges();

      const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b) => (b as HTMLElement).textContent?.trim() === "Crea enllaç d'invitació",
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);

      const tooltip = btn.closest('.tooltip') as HTMLElement | null;
      expect(tooltip?.getAttribute('data-tip')).toContain('responsable legal');
    });

    it('keeps "Crea enllaç d\'invitació" enabled for a non-xicalla person', () => {
      component.person.set(makePerson({ isXicalla: false }));
      component.delegates.set([]);
      fixture.detectChanges();

      const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b) => (b as HTMLElement).textContent?.trim() === "Crea enllaç d'invitació",
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('does not show the "Delegacions" title when there are none and not in edit mode', () => {
      component.delegates.set([makeDelegateItem()]);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Delegacions');
    });

    it('shows the "Delegacions" title in edit mode even with no delegations yet', () => {
      component.delegates.set([makeDelegateItem()]);
      component.editing.set(true);
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Delegacions');
      expect(text).toContain('Cap delegació');
    });

    it('shows the relació text with a visible gap from the name (not glued together)', () => {
      component.delegates.set([makeDelegateItem()]);
      fixture.detectChanges();
      const relationSpan = fixture.nativeElement.querySelector('.ml-1');
      expect(relationSpan).toBeTruthy();
      expect(relationSpan.textContent.trim()).toBe('(Pare/Mare)');
    });

    it('opens the delegate modal with isPrimary true from "Enllaça amb usuari existent"', () => {
      component.delegates.set([]);
      component.editing.set(true);
      fixture.detectChanges();
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b) => (b as HTMLElement).textContent?.trim() === 'Enllaça amb usuari existent',
      ) as HTMLElement;
      btn.click();
      fixture.detectChanges();

      expect(component.delegateModalOpen()).toBe(true);
      expect(component.delegateModalIsPrimary()).toBe(true);
    });

    it('shows "Responsable" with the primary manager\'s email and type badge', () => {
      component.delegates.set([makeDelegateItem()]);
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Responsable');
      expect(text).toContain('parent@test.com');
      expect(text).toContain('Pare/Mare');
    });

    it('shows the primary manager\'s alias (not email) and links to their person page when self-managed', () => {
      component.delegates.set([
        makeDelegateItem({ user: { id: 'user-1', email: 'parent@test.com', person: { id: 'parent-person', alias: 'ParentAlias' } } }),
      ]);
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('a[href*="/persons/parent-person"]') as HTMLAnchorElement | null;
      expect(link).toBeTruthy();
      expect(link!.textContent).toContain('ParentAlias');
      expect(fixture.nativeElement.textContent).not.toContain('parent@test.com');
    });

    it('shows a titled, comma-separated "Delegacions" list for secondary managers, with a remove action each when in edit mode', () => {
      component.delegates.set([
        makeDelegateItem(),
        makeDelegateItem({ id: 'del-2', isPrimary: false, delegateType: DelegateType.PARTNER, user: { id: 'u2', email: 'partner@test.com', person: null } }),
        makeDelegateItem({ id: 'del-3', isPrimary: false, delegateType: DelegateType.OTHER, user: { id: 'u3', email: 'aunt@test.com', person: { id: 'aunt-person', alias: 'AuntAlias' } } }),
      ]);
      component.editing.set(true);
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Delegacions');
      expect(text).toContain('partner@test.com');
      expect(text).toContain('Parella');
      expect(text).toContain('AuntAlias');
      expect(text).not.toContain('aunt@test.com');

      const link = fixture.nativeElement.querySelector('a[href*="/persons/aunt-person"]') as HTMLAnchorElement | null;
      expect(link).toBeTruthy();

      const removeButtons = fixture.nativeElement.querySelectorAll('[aria-label^="Elimina delegat "]');
      expect(removeButtons.length).toBe(2);
    });

    it('does not show remove actions for delegates when not in edit mode', () => {
      component.delegates.set([
        makeDelegateItem(),
        makeDelegateItem({ id: 'del-2', isPrimary: false, delegateType: DelegateType.PARTNER, user: { id: 'u2', email: 'partner@test.com', person: null } }),
      ]);
      fixture.detectChanges();
      const removeButtons = fixture.nativeElement.querySelectorAll('[aria-label^="Elimina delegat "]');
      expect(removeButtons.length).toBe(0);
    });

    it('shows the "Afegeix" action once a primary manager exists and in edit mode', () => {
      component.delegates.set([makeDelegateItem()]);
      component.editing.set(true);
      fixture.detectChanges();
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b) => (b as HTMLElement).textContent?.trim() === '+ Afegeix',
      );
      expect(btn).toBeTruthy();
    });

    it('shows "Afegeix" in edit mode even when there is no manager yet (delegates are independent of the responsable)', () => {
      component.delegates.set([]);
      component.editing.set(true);
      fixture.detectChanges();
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b) => (b as HTMLElement).textContent?.trim() === '+ Afegeix',
      );
      expect(btn).toBeTruthy();
    });

    it('does not show "Afegeix" when not in edit mode, even with a manager', () => {
      component.delegates.set([makeDelegateItem()]);
      fixture.detectChanges();
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b) => (b as HTMLElement).textContent?.trim() === '+ Afegeix',
      );
      expect(btn).toBeFalsy();
    });

    it('shows a remove action for the responsable when in edit mode', () => {
      component.delegates.set([makeDelegateItem()]);
      component.editing.set(true);
      fixture.detectChanges();
      const removeBtn = fixture.nativeElement.querySelector(
        '[aria-label="Elimina responsable parent@test.com"]',
      );
      expect(removeBtn).toBeTruthy();
    });

    it('does not show a remove action for the responsable when not in edit mode', () => {
      component.delegates.set([makeDelegateItem()]);
      fixture.detectChanges();
      const removeBtn = fixture.nativeElement.querySelector(
        '[aria-label="Elimina responsable parent@test.com"]',
      );
      expect(removeBtn).toBeFalsy();
    });

    it('creates an invite link, copies it to the clipboard and shows a success toast', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const createInviteLink = vi.fn().mockReturnValue(
        of({ inviteUrl: 'http://localhost:4300/activate?token=abc', expiresAt: '2026-01-01T00:00:00Z' }),
      );
      (mockPersonService as unknown as { createInviteLink: typeof createInviteLink }).createInviteLink =
        createInviteLink;
      component.person.set(makePerson());

      component.createInviteLink();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(createInviteLink).toHaveBeenCalledWith('p1');
      expect(writeText).toHaveBeenCalledWith('http://localhost:4300/activate?token=abc');
      const toastService = TestBed.inject(ToastService);
      expect(toastService.toasts().at(-1)?.message).toContain('portapapers');
    });

    it('falls back to showing the link in the toast when the clipboard API is unavailable', async () => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      const createInviteLink = vi.fn().mockReturnValue(
        of({ inviteUrl: 'http://localhost:4300/activate?token=abc', expiresAt: '2026-01-01T00:00:00Z' }),
      );
      (mockPersonService as unknown as { createInviteLink: typeof createInviteLink }).createInviteLink =
        createInviteLink;
      component.person.set(makePerson());

      component.createInviteLink();
      await fixture.whenStable();
      fixture.detectChanges();

      const toastService = TestBed.inject(ToastService);
      expect(toastService.toasts().at(-1)?.message).toContain('http://localhost:4300/activate?token=abc');
    });

    it('shows an error toast when creating the invite link fails', async () => {
      const createInviteLink = vi.fn().mockReturnValue(
        throwError(() => ({ error: { message: 'Aquesta persona ja té un compte actiu' } })),
      );
      (mockPersonService as unknown as { createInviteLink: typeof createInviteLink }).createInviteLink =
        createInviteLink;
      component.person.set(makePerson());

      component.createInviteLink();
      fixture.detectChanges();

      const toastService = TestBed.inject(ToastService);
      expect(toastService.toasts().at(-1)?.message).toBe('Aquesta persona ja té un compte actiu');
    });

    it('shows a "Compte actiu" indicator instead of the invite button once the account is active', () => {
      component.person.set(makePerson({ user: { id: 'u1', email: 'active@test.com', isActive: true } }));
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Compte actiu');
      expect(text).not.toContain("Crea enllaç d'invitació");
    });

    it('shows a regenerate button and a "Pendent d\'activar" badge when the linked account is inactive', () => {
      component.person.set(makePerson({ user: { id: 'u1', email: null, isActive: false } }));
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain("Pendent d'activar");
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b) => (b as HTMLElement).textContent?.trim() === "Crea enllaç d'invitació",
      ) as HTMLButtonElement | undefined;
      expect(btn).toBeTruthy();
      expect(btn?.disabled).toBe(false);
    });

    it('getDelegateTypeLabel returns correct labels, including OTHER', () => {
      expect(component.getDelegateTypeLabel(DelegateType.PARENT)).toBe('Pare/Mare');
      expect(component.getDelegateTypeLabel(DelegateType.PARTNER)).toBe('Parella');
      expect(component.getDelegateTypeLabel(DelegateType.GUARDIAN)).toBe('Tutor/a');
      expect(component.getDelegateTypeLabel(DelegateType.OTHER)).toBe('Altres');
    });

    it('askRemoveDelegate opens confirm dialog', () => {
      const delegate = makeDelegateItem();
      component.askRemoveDelegate(delegate);
      fixture.detectChanges();
      const dialog = fixture.nativeElement.querySelector('dialog[role="alertdialog"]');
      expect(dialog).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain('parent@test.com');
    });

    it('cancelRemoveDelegate closes confirm dialog', () => {
      component.askRemoveDelegate(makeDelegateItem());
      fixture.detectChanges();
      component.cancelRemoveDelegate();
      fixture.detectChanges();
      const dialog = fixture.nativeElement.querySelector('dialog[role="alertdialog"]');
      expect(dialog).toBeNull();
    });
  });

  describe('Alçada espatlles (0 is a legacy "not set" sentinel, not a real height)', () => {
    const patchForm = (person: Person) =>
      (component as unknown as { patchForm(p: Person): void }).patchForm(person);

    it('shows a blank field when the person has a legacy shoulderHeight of 0', () => {
      const person = makePerson({ shoulderHeight: 0 });
      component.person.set(person);
      patchForm(person);
      expect(component.form.value.shoulderHeight).toBeNull();
    });

    it('sends null (not 0) when saving with an empty shoulderHeight field', () => {
      const person = makePerson({ shoulderHeight: 0 });
      component.person.set(person);
      patchForm(person);
      component.editing.set(true);
      component.save();

      expect(mockPersonService.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ shoulderHeight: null }),
      );
    });

    it('keeps a real shoulderHeight value when saving', () => {
      const person = makePerson({ shoulderHeight: 145 });
      component.person.set(person);
      patchForm(person);
      component.editing.set(true);
      component.save();

      expect(mockPersonService.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ shoulderHeight: 145 }),
      );
    });
  });
});
