import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, type Mock } from 'vitest';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS, LucideIconProvider,
  RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-angular';
import { PersonPanelComponent } from './person-panel.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AvailablePerson } from '../../models/assignment.model';

const makeAvailablePerson = (
  id = 'person-1',
  status: AvailablePerson['attendanceStatus'] = 'ANIRE',
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
        makeAvailablePerson('p1', 'ANIRE'),
        makeAvailablePerson('p2', 'PENDENT'),
        makeAvailablePerson('p3', 'NO_VAIG'),
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
      const person = makeAvailablePerson('p1', 'ANIRE', { nextPerformanceStatus: 'ANIRE' });
      component.persons.set([person]);
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).toContain('🎭');
    });

    it('formatHeight returns relative height string when heightMode is relative', () => {
      fixture.componentRef.setInput('heightMode', 'relative');
      const person = makeAvailablePerson('p1', 'ANIRE', { shoulderHeight: 142 });
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
});
