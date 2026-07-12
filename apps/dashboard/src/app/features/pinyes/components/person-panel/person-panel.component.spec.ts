import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, type Mock } from 'vitest';
import { of } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { PersonPanelComponent } from './person-panel.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AvailablePerson } from '../../models/assignment.model';
import { SHOULDER_HEIGHT_BASELINE_CM } from '../../../../shared/utils/person.util';
import { TagService } from '../../../config/services/tag.service';

const makeAvailablePerson = (
  id = 'person-1',
  status: AvailablePerson['attendanceStatus'] = 'ANIRE',
  overrides: Partial<AvailablePerson> = {},
): AvailablePerson => ({
  id,
  alias: 'Pepet',
  name: 'Pere',
  firstSurname: 'Garcia',
  shoulderHeight: SHOULDER_HEIGHT_BASELINE_CM,
  isXicalla: false,
  notes: null,
  notesEmoji: null,
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
        { provide: TagService, useValue: { getAll: vi.fn().mockReturnValue(of([])) } },
        allLucideIconsProvider,
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

  // ── isPast mode ────────────────────────────────────────────────────────────

  describe('isPast=true grouping', () => {
    beforeEach(() => {
      const persons = [
        makeAvailablePerson('p1', 'ASSISTIT'),
        makeAvailablePerson('p2', 'ANIRE'),
        makeAvailablePerson('p3', 'NO_VAIG'),
        makeAvailablePerson('p4', 'PENDENT'),
      ];
      assignmentService.getAvailablePersons.mockReturnValue(of({ data: persons }));
      fixture.componentRef.setInput('isPast', true);
      component.loadPersons();
      fixture.detectChanges();
    });

    it('confirmedPersons only includes ASSISTIT', () => {
      expect(component.confirmedPersons()).toHaveLength(1);
      expect(component.confirmedPersons()[0].id).toBe('p1');
    });

    it('noShowPersons includes ANIRE (confirmed but no-show)', () => {
      expect(component.noShowPersons()).toHaveLength(1);
      expect(component.noShowPersons()[0].id).toBe('p2');
    });

    it('pendingPersons is empty (PENDENT treated as declined)', () => {
      expect(component.pendingPersons()).toHaveLength(0);
    });

    it('declinedPersons includes NO_VAIG and PENDENT', () => {
      expect(component.declinedPersons()).toHaveLength(2);
      const ids = component.declinedPersons().map((p) => p.id);
      expect(ids).toContain('p3');
      expect(ids).toContain('p4');
    });
  });

  describe('isPast=false grouping (default)', () => {
    beforeEach(() => {
      const persons = [
        makeAvailablePerson('p1', 'ASSISTIT'),
        makeAvailablePerson('p2', 'ANIRE'),
        makeAvailablePerson('p3', 'NO_VAIG'),
        makeAvailablePerson('p4', 'PENDENT'),
      ];
      assignmentService.getAvailablePersons.mockReturnValue(of({ data: persons }));
      fixture.componentRef.setInput('isPast', false);
      component.loadPersons();
      fixture.detectChanges();
    });

    it('confirmedPersons includes ANIRE and ASSISTIT', () => {
      const ids = component.confirmedPersons().map((p) => p.id);
      expect(ids).toContain('p1');
      expect(ids).toContain('p2');
    });

    it('noShowPersons is empty', () => {
      expect(component.noShowPersons()).toHaveLength(0);
    });

    it('pendingPersons includes PENDENT', () => {
      expect(component.pendingPersons()).toHaveLength(1);
      expect(component.pendingPersons()[0].id).toBe('p4');
    });

    it('declinedPersons includes only NO_VAIG', () => {
      expect(component.declinedPersons()).toHaveLength(1);
      expect(component.declinedPersons()[0].id).toBe('p3');
    });
  });

  // ── filtering ──────────────────────────────────────────────────────────────

  describe('filtering', () => {
    it('typing in the search box does not reload the list below (decoupled from API)', () => {
      const callCount = assignmentService.getAvailablePersons.mock.calls.length;
      component.onSearchChange('pere');
      expect(assignmentService.getAvailablePersons.mock.calls.length).toBe(callCount);
    });

    it('filters by height — calls service with absolute height (140 + relative)', () => {
      component.onHeightChange(10);
      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.objectContaining({ height: 150 }),
      );
    });

    it('filters by height — Max button sets height to 1000 (sorts tallest first)', () => {
      fixture.componentRef.setInput('heightMode', 'relative');
      fixture.detectChanges();
      const maxBtn = fixture.nativeElement.querySelector(
        'button[aria-label="Ordena de més alt a més baix"]',
      ) as HTMLButtonElement;
      maxBtn.click();
      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.objectContaining({ height: SHOULDER_HEIGHT_BASELINE_CM + 1000 }),
      );
    });

    it('filters by height — Min button sets height to -1000 (sorts shortest first)', () => {
      fixture.componentRef.setInput('heightMode', 'relative');
      fixture.detectChanges();
      const minBtn = fixture.nativeElement.querySelector(
        'button[aria-label="Ordena de més baix a més alt"]',
      ) as HTMLButtonElement;
      minBtn.click();
      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.objectContaining({ height: SHOULDER_HEIGHT_BASELINE_CM - 1000 }),
      );
    });

    it('Max button marks itself as selected without writing a value into the height input', () => {
      fixture.componentRef.setInput('heightMode', 'relative');
      fixture.detectChanges();
      component.toggleHeightSort('max');
      fixture.detectChanges();

      expect(component.height()).toBeNull();
      const maxBtn = fixture.nativeElement.querySelector(
        'button[aria-label="Ordena de més alt a més baix"]',
      ) as HTMLButtonElement;
      expect(maxBtn.classList.contains('border-base-content')).toBe(true);
    });

    it('clicking Max again deselects it', () => {
      component.toggleHeightSort('max');
      expect(component.heightSortMode()).toBe('max');
      component.toggleHeightSort('max');
      expect(component.heightSortMode()).toBeNull();
    });

    it('selecting Max clears a previously typed height value', () => {
      component.onHeightChange(15);
      expect(component.height()).toBe(15);
      component.toggleHeightSort('max');
      expect(component.height()).toBeNull();
    });

    it('typing a height value deselects Max/Min', () => {
      component.toggleHeightSort('max');
      expect(component.heightSortMode()).toBe('max');
      component.onHeightChange(5);
      expect(component.heightSortMode()).toBeNull();
    });

    it('excludes persons with no shoulder height set when a height filter is typed', () => {
      const persons = [
        makeAvailablePerson('p1', 'ANIRE', { shoulderHeight: 150 }),
        makeAvailablePerson('p2', 'ANIRE', { shoulderHeight: null }),
        makeAvailablePerson('p3', 'ANIRE', { shoulderHeight: 0 }),
      ];
      assignmentService.getAvailablePersons.mockReturnValue(of({ data: persons }));
      component.onHeightChange(-10);
      fixture.detectChanges();

      const ids = component.confirmedPersons().map((p) => p.id);
      expect(ids).toEqual(['p1']);
    });

    it('excludes persons with no shoulder height set when Min sort is active', () => {
      const persons = [
        makeAvailablePerson('p1', 'ANIRE', { shoulderHeight: 150 }),
        makeAvailablePerson('p2', 'ANIRE', { shoulderHeight: null }),
      ];
      assignmentService.getAvailablePersons.mockReturnValue(of({ data: persons }));
      component.toggleHeightSort('min');
      fixture.detectChanges();

      const ids = component.confirmedPersons().map((p) => p.id);
      expect(ids).toEqual(['p1']);
    });

    it('does not exclude persons with no shoulder height when no height selection is active', () => {
      const persons = [
        makeAvailablePerson('p1', 'ANIRE', { shoulderHeight: 150 }),
        makeAvailablePerson('p2', 'ANIRE', { shoulderHeight: null }),
      ];
      component.persons.set(persons);
      fixture.detectChanges();

      expect(component.confirmedPersons()).toHaveLength(2);
    });

    it('filters by xicalla checkbox — unchecking adds isXicalla=false filter', () => {
      component.onXicallaChange(false);
      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.objectContaining({ isXicalla: false }),
      );
    });

    it('filters by tag — selecting a tag adds positionId to the query', () => {
      component.onPositionFilterChange('pos-agulla');
      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.objectContaining({ positionId: 'pos-agulla' }),
      );
    });

    it('clearing the tag filter omits positionId from the query', () => {
      component.onPositionFilterChange('pos-agulla');
      assignmentService.getAvailablePersons.mockClear();
      component.onPositionFilterChange('');
      const lastQuery = assignmentService.getAvailablePersons.mock.calls.at(-1)?.[2];
      expect(lastQuery).not.toHaveProperty('positionId');
    });

    it('renders a colored dot for each tag in the filter dropdown', () => {
      component.tags.set([
        { id: 't1', name: 'Vents', slug: 'vents', shortDescription: null, longDescription: null, color: '#ff0000', positionTypes: [], personCount: 0 },
      ]);
      component.tagFilterOpen.set(true);
      fixture.detectChanges();

      const dot: HTMLElement | null = fixture.nativeElement.querySelector('[data-testid="tag-filter-dot-t1"]');
      expect(dot).toBeTruthy();
      expect(dot!.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('clicking a tag option in the dropdown filters by that tag', () => {
      component.tags.set([
        { id: 't1', name: 'Vents', slug: 'vents', shortDescription: null, longDescription: null, color: '#ff0000', positionTypes: [], personCount: 0 },
      ]);
      component.tagFilterOpen.set(true);
      fixture.detectChanges();

      const option: HTMLElement = fixture.nativeElement.querySelector('[data-testid="tag-filter-option-t1"]');
      option.click();

      expect(assignmentService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.objectContaining({ positionId: 't1' }),
      );
    });

    it('typing in the tag search box narrows the visible tag options', () => {
      component.tags.set([
        { id: 't1', name: 'Vents', slug: 'vents', shortDescription: null, longDescription: null, color: '#ff0000', positionTypes: [], personCount: 0 },
        { id: 't2', name: 'Agulla', slug: 'agulla', shortDescription: null, longDescription: null, color: '#00ff00', positionTypes: [], personCount: 0 },
      ]);
      component.tagFilterOpen.set(true);
      fixture.detectChanges();

      component.onTagSearchChange('vent');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="tag-filter-option-t1"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="tag-filter-option-t2"]')).toBeFalsy();
    });

    it('shows a clear button next to the trigger when a tag filter is active', () => {
      component.tags.set([
        { id: 't1', name: 'Vents', slug: 'vents', shortDescription: null, longDescription: null, color: '#ff0000', positionTypes: [], personCount: 0 },
      ]);
      component.onPositionFilterChange('t1');
      fixture.detectChanges();

      const clearBtn = fixture.nativeElement.querySelector('[data-testid="tag-filter-clear"]');
      expect(clearBtn).toBeTruthy();
    });

    it('does not show a clear button when no tag filter is active', () => {
      fixture.detectChanges();
      const clearBtn = fixture.nativeElement.querySelector('[data-testid="tag-filter-clear"]');
      expect(clearBtn).toBeFalsy();
    });

    it('clicking the clear button resets the tag filter', () => {
      component.tags.set([
        { id: 't1', name: 'Vents', slug: 'vents', shortDescription: null, longDescription: null, color: '#ff0000', positionTypes: [], personCount: 0 },
      ]);
      component.onPositionFilterChange('t1');
      fixture.detectChanges();

      const clearBtn: HTMLElement = fixture.nativeElement.querySelector('[data-testid="tag-filter-clear"]');
      clearBtn.click();

      expect(component.selectedPositionId()).toBeNull();
      const lastQuery = assignmentService.getAvailablePersons.mock.calls.at(-1)?.[2];
      expect(lastQuery).not.toHaveProperty('positionId');
    });

    it.skip('"Nomes lliures" is on by default (excludeAssigned=true)', () => {
      // TODO: re-enable when excludeAssigned input is added to PersonPanelComponent
    });

    it.skip('toggling "Nomes lliures" off reloads with excludeAssigned=false', () => {
      // TODO: re-enable when onExcludeAssignedChange is added to PersonPanelComponent
    });
  });

  // ── auto Xicalla toggle on node selection ───────────────────────────────────

  describe('auto Xicalla toggle on node selection', () => {
    it('activates the Xicalla filter when a TRONC node is selected', () => {
      fixture.componentRef.setInput('selectedNodeZone', 'TRONC');
      fixture.componentRef.setInput('selectedNodeId', 'node-1');
      fixture.detectChanges();
      expect(component.showXicalla()).toBe(true);
    });

    it('reloads persons without the isXicalla filter when a TRONC node is selected', () => {
      assignmentService.getAvailablePersons.mockClear();
      fixture.componentRef.setInput('selectedNodeZone', 'TRONC');
      fixture.componentRef.setInput('selectedNodeId', 'node-1');
      fixture.detectChanges();
      const lastQuery = assignmentService.getAvailablePersons.mock.calls.at(-1)?.[2];
      expect(lastQuery).not.toHaveProperty('isXicalla');
    });

    it('reloads persons with isXicalla=false when a non-TRONC node is selected', () => {
      component.showXicalla.set(true);
      assignmentService.getAvailablePersons.mockClear();
      fixture.componentRef.setInput('selectedNodeZone', 'PINYA');
      fixture.componentRef.setInput('selectedNodeId', 'node-2');
      fixture.detectChanges();
      const lastQuery = assignmentService.getAvailablePersons.mock.calls.at(-1)?.[2];
      expect(lastQuery).toMatchObject({ isXicalla: false });
    });

    it('deactivates the Xicalla filter when a non-TRONC node is selected', () => {
      component.showXicalla.set(true);
      fixture.componentRef.setInput('selectedNodeZone', 'PINYA');
      fixture.componentRef.setInput('selectedNodeId', 'node-2');
      fixture.detectChanges();
      expect(component.showXicalla()).toBe(false);
    });

    it('leaves the Xicalla filter untouched when the node is deselected', () => {
      fixture.componentRef.setInput('selectedNodeZone', 'TRONC');
      fixture.componentRef.setInput('selectedNodeId', 'node-1');
      fixture.detectChanges();
      expect(component.showXicalla()).toBe(true);

      fixture.componentRef.setInput('selectedNodeZone', null);
      fixture.componentRef.setInput('selectedNodeId', null);
      fixture.detectChanges();
      expect(component.showXicalla()).toBe(true);
    });

    it('does not steal focus from the height input when a node gets selected mid-typing', async () => {
      const heightInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="number"]');
      heightInput.focus();
      expect(document.activeElement).toBe(heightInput);

      fixture.componentRef.setInput('selectedNodeId', 'node-1');
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(document.activeElement).toBe(heightInput);
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

    it('selectPerson clears the search box', () => {
      component.search.set('pere');
      component.selectPerson(makeAvailablePerson());
      expect(component.search()).toBe('');
    });

    it('"Refrescar" button reloads available persons', () => {
      const callCount = assignmentService.getAvailablePersons.mock.calls.length;
      component.loadPersons();
      expect(assignmentService.getAvailablePersons.mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  // ── search dropdown (typeahead ranking) ───────────────────────────────────

  describe('searchResults ranking', () => {
    it('is empty when the search box is empty', () => {
      component.persons.set([makeAvailablePerson('p1', 'ANIRE', { alias: 'Pepet' })]);
      component.search.set('');
      fixture.detectChanges();
      expect(component.searchResults()).toHaveLength(0);
    });

    it('an exact alias match wins regardless of attendance status', () => {
      component.persons.set([
        makeAvailablePerson('p1', 'ANIRE', { alias: 'Petitó' }),
        makeAvailablePerson('p2', 'NO_VAIG', { alias: 'Pere' }),
      ]);
      component.search.set('pere');
      fixture.detectChanges();

      const results = component.searchResults();
      expect(results[0].person.id).toBe('p2');
    });

    it('ignores accents and case for the exact match', () => {
      component.persons.set([makeAvailablePerson('p1', 'ANIRE', { alias: 'Andréu' })]);
      component.search.set('ANDREU');
      fixture.detectChanges();

      expect(component.searchResults()[0].person.id).toBe('p1');
    });

    it('orders by alias-prefix, then name-prefix, then alias-substring, then name-substring', () => {
      component.persons.set([
        makeAvailablePerson('p1', 'ANIRE', { alias: 'Xic Marc', name: 'Xavier' }), // alias substring
        makeAvailablePerson('p2', 'ANIRE', { alias: 'Marcel', name: 'Josep' }), // alias prefix
        makeAvailablePerson('p3', 'ANIRE', { alias: 'Toni', name: 'Marcelí' }), // name prefix
        makeAvailablePerson('p4', 'ANIRE', { alias: 'Bep', name: 'Xic Marc' }), // name substring
      ]);
      component.search.set('marc');
      fixture.detectChanges();

      const ids = component.searchResults().map((r) => r.person.id);
      expect(ids).toEqual(['p2', 'p3', 'p1', 'p4']);
    });

    it('excludes persons with no substring match at all (no fuzzy matching)', () => {
      component.persons.set([makeAvailablePerson('p1', 'ANIRE', { alias: 'Roc', name: 'Marc' })]);
      component.search.set('xyz');
      fixture.detectChanges();

      expect(component.searchResults()).toHaveLength(0);
    });

    it('caps results at 5', () => {
      const persons = Array.from({ length: 8 }, (_, i) =>
        makeAvailablePerson(`p${i}`, 'ANIRE', { alias: `Marc${i}` }),
      );
      component.persons.set(persons);
      component.search.set('marc');
      fixture.detectChanges();

      expect(component.searchResults()).toHaveLength(5);
    });

    it('lists already-assigned-elsewhere persons as isAssigned', () => {
      component.persons.set([
        makeAvailablePerson('p1', 'ANIRE', {
          alias: 'Marcel·lí',
          assignedInSegment: true,
          assignedInstanceId: 'instance-1',
          assignedNodeLabel: 'Base 2',
        }),
      ]);
      component.search.set('marc');
      fixture.detectChanges();

      const result = component.searchResults()[0];
      expect(result.isAssigned).toBe(true);
      expect(result.person.id).toBe('p1');
    });

    it('selecting an assigned result emits assignedPersonSelected instead of personSelected', () => {
      const assignedSpy = vi.fn();
      component.assignedPersonSelected.subscribe(assignedSpy);

      const person = makeAvailablePerson('p1', 'ANIRE', {
        alias: 'Marcel·lí',
        assignedInSegment: true,
        assignedInstanceId: 'instance-1',
      });
      component.selectSearchResult({ person, isAssigned: true });

      expect(assignedSpy).toHaveBeenCalledWith({ personId: 'p1', instanceId: 'instance-1' });
      expect(personSelectedSpy).not.toHaveBeenCalled();
      expect(component.search()).toBe('');
    });
  });

  // ── keyboard navigation ────────────────────────────────────────────────────

  describe('search keyboard navigation', () => {
    const makeKeyEvent = (key: string, shiftKey = false) =>
      ({ key, shiftKey, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

    beforeEach(() => {
      component.persons.set([
        makeAvailablePerson('p1', 'ANIRE', { alias: 'Marc1' }),
        makeAvailablePerson('p2', 'ANIRE', { alias: 'Marc2' }),
        makeAvailablePerson('p3', 'ANIRE', { alias: 'Marc3' }),
      ]);
      component.search.set('marc');
      fixture.detectChanges();
    });

    it('ArrowDown moves the highlighted index forward, clamped to the last result', () => {
      component.onSearchKeyDown(makeKeyEvent('ArrowDown'));
      expect(component.effectiveHighlightedIndex()).toBe(1);
      component.onSearchKeyDown(makeKeyEvent('ArrowDown'));
      component.onSearchKeyDown(makeKeyEvent('ArrowDown'));
      expect(component.effectiveHighlightedIndex()).toBe(2);
    });

    it('ArrowUp moves the highlighted index backward, clamped to 0', () => {
      component.onSearchKeyDown(makeKeyEvent('ArrowDown'));
      component.onSearchKeyDown(makeKeyEvent('ArrowUp'));
      component.onSearchKeyDown(makeKeyEvent('ArrowUp'));
      expect(component.effectiveHighlightedIndex()).toBe(0);
    });

    it('Tab behaves like ArrowDown and Shift+Tab like ArrowUp', () => {
      component.onSearchKeyDown(makeKeyEvent('Tab'));
      expect(component.effectiveHighlightedIndex()).toBe(1);
      component.onSearchKeyDown(makeKeyEvent('Tab', true));
      expect(component.effectiveHighlightedIndex()).toBe(0);
    });

    it('Enter assigns the highlighted result, not just the first one', () => {
      component.onSearchKeyDown(makeKeyEvent('ArrowDown'));
      component.onSearchKeyDown(makeKeyEvent('Enter'));
      expect(personSelectedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }));
    });

    it('Enter with an empty search falls back to the first free confirmed person', () => {
      component.search.set('');
      fixture.detectChanges();
      component.onSearchKeyDown(makeKeyEvent('Enter'));
      expect(personSelectedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
    });

    it('Enter with search text but no matches does not select anyone', () => {
      component.search.set('zzz');
      fixture.detectChanges();
      component.onSearchKeyDown(makeKeyEvent('Enter'));
      expect(personSelectedSpy).not.toHaveBeenCalled();
    });
  });

  // ── sortedConfirmedPersons (F2 intelligent filter) ─────────────────────────

  describe('sortedConfirmedPersons', () => {
    const posVents = { id: 'pos-vents', name: 'Vents', slug: 'vents', color: '#A5D6A7', positionTypes: ['vents'] };
    const posAgulla = { id: 'pos-agulla', name: 'Agulla', slug: 'agulla', color: '#0d9488', positionTypes: ['agulla'] };

    it('returns confirmedPersons in original order when activeNodePositionType is null', () => {
      const persons = [
        makeAvailablePerson('p1', 'ANIRE', { positions: [] }),
        makeAvailablePerson('p2', 'ANIRE', { positions: [posVents] }),
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
        makeAvailablePerson('p1', 'ANIRE', { positions: [] }),
        makeAvailablePerson('p2', 'ANIRE', { positions: [posVents] }),
        makeAvailablePerson('p3', 'ANIRE', { positions: [] }),
      ];
      component.persons.set(persons);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const sorted = component.sortedConfirmedPersons();
      expect(sorted[0].id).toBe('p2');
    });

    it('does not change order when no person matches the positionType slug', () => {
      const persons = [
        makeAvailablePerson('p1', 'ANIRE', { positions: [posAgulla] }),
        makeAvailablePerson('p2', 'ANIRE', { positions: [posAgulla] }),
      ];
      component.persons.set(persons);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const sorted = component.sortedConfirmedPersons();
      expect(sorted[0].id).toBe('p1');
      expect(sorted[1].id).toBe('p2');
    });

    it('renders colored dot for person with matching position slug', () => {
      const person = makeAvailablePerson('p1', 'ANIRE', { positions: [posVents] });
      component.persons.set([person]);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const dot = fixture.nativeElement.querySelector('[style*="background-color"]');
      expect(dot).toBeTruthy();
    });

    it('does not dim non-matching person when positionType is active (normal text color)', () => {
      const persons = [
        makeAvailablePerson('p1', 'ANIRE', { positions: [posVents] }),
        makeAvailablePerson('p2', 'ANIRE', { positions: [] }),
      ];
      component.persons.set(persons);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button[aria-label^="Seleccionar"]'),
      );
      const nonMatchBtn = buttons.find((b) => !b.classList.contains('opacity-60'));
      expect(buttons.some((b) => b.classList.contains('opacity-60'))).toBe(false);
      expect(nonMatchBtn).toBeTruthy();
    });

    it('does not apply opacity-60 when activeNodePositionType is null', () => {
      const person = makeAvailablePerson('p1', 'ANIRE', { positions: [] });
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

  // ── assignedPersons tag filtering ───────────────────────────────────────────

  describe('assignedPersons tag filtering', () => {
    const posVents = { id: 'tag-vents', name: 'Vents', slug: 'vents', color: '#A5D6A7', positionTypes: ['vents'] };

    const makeAssignment = (personId: string) => ({
      id: `assignment-${personId}`,
      figureInstanceId: 'instance-1',
      node: {
        id: 'node-1',
        label: 'Base 1',
        zone: 'BASE',
        z: 0,
        positionType: null,
        sortOrder: 0,
        climbIndicator: null,
        ringLevel: null,
        originNodeId: null,
        sourceNodeId: null,
      },
      person: { id: personId, alias: 'Pepet', name: 'Pere', firstSurname: 'Garcia', shoulderHeight: null },
    });

    it('excludes an assigned person missing from the (tag-filtered) persons list', () => {
      // Simulates the backend having excluded this person from `persons()` because
      // they don't have the selected tag — the optimistic "extras" fallback used to
      // add them back anyway since it only reads from `assignments()`.
      component.persons.set([]);
      component.selectedPositionId.set('tag-vents');
      fixture.componentRef.setInput('assignments', [makeAssignment('p1')]);
      fixture.detectChanges();

      expect(component.assignedPersons()).toHaveLength(0);
    });

    it('includes an assigned person found in persons() whose tag matches the filter', () => {
      component.persons.set([makeAvailablePerson('p1', 'ANIRE', { positions: [posVents] })]);
      component.selectedPositionId.set('tag-vents');
      fixture.componentRef.setInput('assignments', [makeAssignment('p1')]);
      fixture.detectChanges();

      expect(component.assignedPersons().map((p) => p.id)).toEqual(['p1']);
    });

    it('includes all assigned persons when no tag filter is active', () => {
      component.persons.set([]);
      component.selectedPositionId.set(null);
      fixture.componentRef.setInput('assignments', [makeAssignment('p1')]);
      fixture.detectChanges();

      expect(component.assignedPersons().map((p) => p.id)).toEqual(['p1']);
    });
  });

  // ── assignedPersons position-match dot ──────────────────────────────────────

  describe('assignedPersons position-match dot', () => {
    const posVents = { id: 'pos-vents', name: 'Vents', slug: 'vents', color: '#A5D6A7', positionTypes: ['vents'] };

    it('renders a colored dot for an assigned person whose position matches the active node type', () => {
      const person = makeAvailablePerson('p1', 'ANIRE', {
        positions: [posVents],
        assignedInSegment: true,
        assignedInstanceId: 'instance-1',
        assignedNodeLabel: 'Base 2',
      });
      component.persons.set([person]);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('#assignades-panel');
      const dot = panel?.querySelector('[style*="background-color"]');
      expect(dot).toBeTruthy();
    });

    it('does not render a dot for an assigned person whose position does not match', () => {
      const person = makeAvailablePerson('p1', 'ANIRE', {
        positions: [],
        assignedInSegment: true,
        assignedInstanceId: 'instance-1',
        assignedNodeLabel: 'Base 2',
      });
      component.persons.set([person]);
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('#assignades-panel');
      const dot = panel?.querySelector('[style*="background-color"]');
      expect(dot).toBeFalsy();
    });
  });
});
