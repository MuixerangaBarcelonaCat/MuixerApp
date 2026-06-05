import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, type Mock } from 'vitest';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS, LucideIconProvider,
  RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-angular';
import { AttendanceStatus } from '@muixer/shared';
import { PersonPanelComponent } from './person-panel.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AvailablePerson } from '../../models/assignment.model';

const makeAvailablePerson = (
  id = 'person-1',
  status: AvailablePerson['attendanceStatus'] = AttendanceStatus.ANIRE,
  overrides: Partial<AvailablePerson> = {},
): AvailablePerson => ({
  id,
  alias: 'Pepet',
  name: 'Pere',
  firstSurname: 'Garcia',
  shoulderHeight: 140,
  isXicalla: false,
  attendanceStatus: status,
  nextPerformanceStatus: null,
  assignedInSegment: false,
  positions: [],
  ...overrides,
});

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';

describe('PersonPanelComponent', () => {
  let fixture: ComponentFixture<PersonPanelComponent>;
  let component: PersonPanelComponent;
  let assignmentService: { getAvailablePersons: ReturnType<typeof vi.fn> };
  let personSelectedSpy: Mock;

  beforeEach(async () => {
    assignmentService = {
      getAvailablePersons: vi.fn().mockReturnValue(of({ data: [makeAvailablePerson()] })),
    };

    await TestBed.configureTestingModule({
      imports: [PersonPanelComponent],
      providers: [
        { provide: NodeAssignmentService, useValue: assignmentService },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({ RefreshCw, ChevronDown, ChevronUp }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('eventId', EVENT_ID);
    fixture.componentRef.setInput('segmentId', SEGMENT_ID);

    personSelectedSpy = vi.fn();
    component.personSelected.subscribe((p) => personSelectedSpy(p));

    fixture.detectChanges();
  });

  // ── initialization ─────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('creates successfully', () => {
      expect(component).toBeTruthy();
    });

    it('loads available persons on init', () => {
      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.any(Object),
      );
    });

    it('separates persons into Confirmades (ANIRE) and Altres blocks', () => {
      const persons = [
        makeAvailablePerson('p1', AttendanceStatus.ANIRE),
        makeAvailablePerson('p2', AttendanceStatus.PENDENT),
        makeAvailablePerson('p3', AttendanceStatus.NO_VAIG),
      ];
      assignmentService.getAvailablePersons.mockReturnValue(of({ data: persons }));
      component.loadPersons();
      fixture.detectChanges();

      expect(component.confirmedPersons()).toHaveLength(1);
      expect(component.pendingPersons()).toHaveLength(1);
      expect(component.declinedPersons()).toHaveLength(1);
    });
  });

  // ── filtering ──────────────────────────────────────────────────────────────

  describe('filtering', () => {
    it('filters by search text — calls service with search param', () => {
      component.onSearchChange('pere');
      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.objectContaining({ search: 'pere' }),
      );
    });

    it('filters by height — calls service with absolute height (140 + relative)', () => {
      component.onHeightChange(10);
      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.objectContaining({ height: 150 }),
      );
    });

    it('filters by xicalla checkbox — unchecking adds isXicalla=false filter', () => {
      component.onXicallaChange(false);
      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.objectContaining({ isXicalla: false }),
      );
    });

    it.skip('"Nomes lliures" is on by default (excludeAssigned=true)', () => {
      // TODO: re-enable when excludeAssigned input is added to PersonPanelComponent
    });

    it.skip('toggling "Nomes lliures" off reloads with excludeAssigned=false', () => {
      // TODO: re-enable when onExcludeAssignedChange is added to PersonPanelComponent
    });
  });

  // ── blocks ─────────────────────────────────────────────────────────────────

  describe('blocks', () => {
    it('"Altres" block is collapsed by default', () => {
      expect(component.altresExpanded()).toBe(false);
    });

    it('expanding "Altres" sets altresExpanded to true', () => {
      component.toggleAltres();
      expect(component.altresExpanded()).toBe(true);
    });

    it('persons show 🎭 indicator when nextPerformanceStatus is ANIRE', () => {
      const person = makeAvailablePerson('p1', AttendanceStatus.ANIRE, { nextPerformanceStatus: AttendanceStatus.ANIRE });
      component.persons.set([person]);
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).toContain('🎭');
    });

    it('formatHeight returns relative height string when heightMode is relative', () => {
      fixture.componentRef.setInput('heightMode', 'relative');
      const person = makeAvailablePerson('p1', AttendanceStatus.ANIRE, { shoulderHeight: 142 });
      const result = component.formatHeight(person);
      expect(result).toBe('+2');
    });
  });

  // ── interaction ────────────────────────────────────────────────────────────

  describe('interaction', () => {
    it('click on person emits personSelected output', () => {
      const person = makeAvailablePerson();
      component.selectPerson(person);
      expect(personSelectedSpy).toHaveBeenCalledWith(person);
    });

    it('"Refrescar" button reloads available persons', () => {
      const callCount = assignmentService.getAvailablePersons.mock.calls.length;
      component.loadPersons();
      expect(assignmentService.getAvailablePersons.mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  // ── sortedConfirmedPersons (F2 intelligent filter) ─────────────────────────

  describe('sortedConfirmedPersons', () => {
    const posVents = { id: 'pos-vents', name: 'Vents', slug: 'vents', color: '#A5D6A7' };
    const posAgulla = { id: 'pos-agulla', name: 'Agulla', slug: 'agulla', color: '#0d9488' };

    it('returns confirmedPersons in original order when activeNodePositionType is null', () => {
      const persons = [
        makeAvailablePerson('p1', AttendanceStatus.ANIRE, { positions: [] }),
        makeAvailablePerson('p2', AttendanceStatus.ANIRE, { positions: [posVents] }),
      ];
      component.persons.set(persons);
      fixture.componentRef.setInput('activeNodePositionType', null);
      fixture.detectChanges();

      const sorted = component.sortedConfirmedPersons();
      expect(sorted[0].id).toBe('p1');
      expect(sorted[1].id).toBe('p2');
    });

    it('puts persons with matching slug first', () => {
      const persons = [
        makeAvailablePerson('p1', AttendanceStatus.ANIRE, { positions: [] }),
        makeAvailablePerson('p2', AttendanceStatus.ANIRE, { positions: [posVents] }),
        makeAvailablePerson('p3', AttendanceStatus.ANIRE, { positions: [] }),
      ];
      component.persons.set(persons);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const sorted = component.sortedConfirmedPersons();
      expect(sorted[0].id).toBe('p2');
    });

    it('does not change order when no person matches the positionType slug', () => {
      const persons = [
        makeAvailablePerson('p1', AttendanceStatus.ANIRE, { positions: [posAgulla] }),
        makeAvailablePerson('p2', AttendanceStatus.ANIRE, { positions: [posAgulla] }),
      ];
      component.persons.set(persons);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const sorted = component.sortedConfirmedPersons();
      expect(sorted[0].id).toBe('p1');
      expect(sorted[1].id).toBe('p2');
    });

    it('renders colored dot for person with matching position slug', () => {
      const person = makeAvailablePerson('p1', AttendanceStatus.ANIRE, { positions: [posVents] });
      component.persons.set([person]);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const dot = fixture.nativeElement.querySelector('[style*="background-color"]');
      expect(dot).toBeTruthy();
    });

    it('renders opacity-60 on button for non-matching person when positionType is active', () => {
      const persons = [
        makeAvailablePerson('p1', AttendanceStatus.ANIRE, { positions: [posVents] }),
        makeAvailablePerson('p2', AttendanceStatus.ANIRE, { positions: [] }),
      ];
      component.persons.set(persons);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button[aria-label^="Seleccionar"]'),
      );
      const nonMatchBtn = buttons.find((b) => b.classList.contains('opacity-60'));
      expect(nonMatchBtn).toBeTruthy();
    });

    it('does not apply opacity-60 when activeNodePositionType is null', () => {
      const person = makeAvailablePerson('p1', AttendanceStatus.ANIRE, { positions: [] });
      component.persons.set([person]);
      fixture.componentRef.setInput('activeNodePositionType', null);
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button[aria-label^="Seleccionar"]'),
      );
      const dimBtn = buttons.find((b) => b.classList.contains('opacity-60'));
      expect(dimBtn).toBeFalsy();
    });
  });
});
