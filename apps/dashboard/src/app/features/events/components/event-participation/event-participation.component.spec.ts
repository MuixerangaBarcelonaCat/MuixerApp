import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  EventParticipationComponent,
  ParticipationRow,
} from './event-participation.component';
import { ParticipationService } from '../../services/participation.service';
import {
  EventParticipation,
  ParticipationMeta,
  ParticipationPerson,
  ParticipationPlacement,
  ParticipationSegment,
} from '../../models/participation.model';
import { ColumnDef, ColumnPill } from '../../../../shared/models/column-def.model';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';

const EVENT_ID = 'event-1';
const SEG_A = 'seg-a';
const SEG_B = 'seg-b';

const makeSegment = (id: string, overrides: Partial<ParticipationSegment> = {}): ParticipationSegment => ({
  id,
  name: `Segment ${id}`,
  sortOrder: 0,
  figureNames: ['4d7'],
  isPublished: true,
  figureCount: 1,
  snapshottedFigureCount: 1,
  ...overrides,
});

const makePlacement = (overrides: Partial<ParticipationPlacement> = {}): ParticipationPlacement => ({
  assignmentId: 'a-1',
  instanceId: 'inst-1',
  figureName: '4d7',
  nodeId: 'n-1',
  nodeLabel: 'Mans',
  zone: 'PINYA',
  area: 'PINYA',
  positionType: null,
  z: 0,
  renglaPosition: 2,
  ...overrides,
});

const makeTroncPlacement = (overrides: Partial<ParticipationPlacement> = {}): ParticipationPlacement =>
  makePlacement({
    assignmentId: 'a-tronc-1',
    nodeId: 'n-tronc-1',
    nodeLabel: 'Segona',
    zone: 'TRONC',
    area: 'TRONC',
    renglaPosition: null,
    ...overrides,
  });

const makeMeta = (overrides: Partial<ParticipationMeta> = {}): ParticipationMeta => ({
  distinctPersons: 0,
  personsWithPlacement: 0,
  totalPlacements: 0,
  conflictedPersons: 0,
  conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
  troncPlacements: 0,
  ...overrides,
});

const makePerson = (
  id: string,
  alias: string,
  placements: Record<string, ParticipationPlacement[]> = {},
  overrides: Partial<ParticipationPerson> = {},
): ParticipationPerson => {
  const segmentIds = Object.keys(placements);
  return {
    id,
    alias,
    name: 'Joana',
    firstSurname: 'Vila',
    shoulderHeight: 140,
    isXicalla: false,
    isActive: true,
    notes: null,
    notesEmoji: null,
    attendanceStatus: 'ANIRE',
    positions: [],
    placements,
    assignedSegmentCount: segmentIds.length,
    placementCount: segmentIds.reduce((t, k) => t + placements[k].length, 0),
    troncPlacementCount: segmentIds.reduce(
      (t, k) => t + placements[k].filter((p) => p.area === 'TRONC').length,
      0,
    ),
    conflictSegmentIds: segmentIds.filter((k) => placements[k].length > 1),
    ...overrides,
  };
};

// ── Pure-unit tests: stateless helpers, no TestBed needed ────────────────────

describe('EventParticipationComponent — statusLabel', () => {
  let component: Pick<EventParticipationComponent, 'statusLabel' | 'isPast'>;

  beforeEach(() => {
    component = Object.create(EventParticipationComponent.prototype) as EventParticipationComponent;
  });

  describe('past event', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => true;
    });

    it.each([
      ['PENDENT', 'Sense resposta'],
      ['ANIRE', 'No presentat'],
      ['NO_VAIG', 'No va anar'],
      ['ASSISTIT', 'Assistit'],
    ] as const)('%s → "%s"', (status, expected) => {
      expect(component.statusLabel(status)).toBe(expected);
    });
  });

  describe('future event', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => false;
    });

    it.each([
      ['PENDENT', 'Pendent'],
      ['ANIRE', 'Aniré'],
      ['NO_VAIG', 'No vaig'],
    ] as const)('%s → "%s"', (status, expected) => {
      expect(component.statusLabel(status)).toBe(expected);
    });
  });
});

describe('EventParticipationComponent — statusBadgeClass', () => {
  let component: Pick<EventParticipationComponent, 'statusBadgeClass' | 'isPast'>;

  beforeEach(() => {
    component = Object.create(EventParticipationComponent.prototype) as EventParticipationComponent;
  });

  it('ANIRE reads as success while the event is upcoming', () => {
    (component as unknown as { isPast: () => boolean }).isPast = () => false;
    expect(component.statusBadgeClass('ANIRE')).toBe('badge-success');
  });

  it('ANIRE becomes a warning once the event is past (a no-show)', () => {
    (component as unknown as { isPast: () => boolean }).isPast = () => true;
    expect(component.statusBadgeClass('ANIRE')).toBe('badge-warning');
  });
});

describe('EventParticipationComponent — segmentLabel', () => {
  let component: Pick<EventParticipationComponent, 'segmentLabel' | 'segmentTooltip'>;

  beforeEach(() => {
    component = Object.create(EventParticipationComponent.prototype) as EventParticipationComponent;
  });

  it('uses the segment name when it has one', () => {
    expect(component.segmentLabel(makeSegment(SEG_A, { name: 'Primera ronda' }))).toBe('Primera ronda');
  });

  it('falls back to a short ordinal when unnamed, because a column header has no room', () => {
    expect(component.segmentLabel(makeSegment(SEG_A, { name: null, sortOrder: 2 }))).toBe('Segment 3');
  });

  it('treats a blank name as unnamed', () => {
    expect(component.segmentLabel(makeSegment(SEG_A, { name: '   ', sortOrder: 0 }))).toBe('Segment 1');
  });

  it('puts the figure list in the tooltip instead', () => {
    expect(component.segmentTooltip(makeSegment(SEG_A, { figureNames: ['4d7', '3d7'] }))).toBe('4d7 + 3d7');
  });

  it('says so when a segment has no figures', () => {
    expect(component.segmentTooltip(makeSegment(SEG_A, { figureNames: [] }))).toBe('Sense figures');
  });
});

describe('EventParticipationComponent — personLabel', () => {
  let component: Pick<EventParticipationComponent, 'personLabel'>;

  beforeEach(() => {
    component = Object.create(EventParticipationComponent.prototype) as EventParticipationComponent;
  });

  it('is just the alias for an ordinary person', () => {
    expect(component.personLabel(makePerson('p1', 'PERSIANA'))).toBe('PERSIANA');
  });

  it('marks xicalla', () => {
    expect(component.personLabel(makePerson('p1', 'PERSIANA', {}, { isXicalla: true }))).toContain('👶');
  });

  it('shows the notes emoji when the person has observations', () => {
    const row = makePerson('p1', 'PERSIANA', {}, { notes: 'genoll', notesEmoji: '🩹' });
    expect(component.personLabel(row)).toContain('🩹');
  });

  it('falls back to a default glyph for observations without an emoji', () => {
    const row = makePerson('p1', 'PERSIANA', {}, { notes: 'genoll', notesEmoji: null });
    expect(component.personLabel(row)).toContain('⚠️');
  });

  /** The conflict glyph itself is rendered as the `person` column's coloured `prefix`,
   *  not folded into this plain-text label — see the `prefix` test below. */
  it('does not fold the conflict glyph into the plain-text label', () => {
    const row = makePerson('p1', 'PERSIANA', {}, { conflictSegmentIds: [SEG_A] });
    expect(component.personLabel(row)).not.toContain('‼');
  });

  it('does NOT mark a person who simply has nothing to do', () => {
    const row = makePerson('p1', 'PERSIANA', {});
    expect(component.personLabel(row)).toBe('PERSIANA');
  });
});

// ── TestBed tests ────────────────────────────────────────────────────────────

describe('EventParticipationComponent', () => {
  const buildResponse = (overrides: Partial<EventParticipation> = {}): EventParticipation => ({
    event: { id: EVENT_ID, title: 'Assaig', date: '2026-05-01' },
    segments: [makeSegment(SEG_A, { name: 'Primera', sortOrder: 0 }), makeSegment(SEG_B, { name: 'Segona', sortOrder: 1 })],
    persons: [
      makePerson('p1', 'PERSIANA', {
        [SEG_A]: [makePlacement()],
        [SEG_B]: [makePlacement({ assignmentId: 'a-2', nodeLabel: 'Vent', figureName: '3d7', renglaPosition: 1 })],
      }),
      makePerson('p2', 'GRILLAT', { [SEG_A]: [makePlacement({ assignmentId: 'a-3', nodeLabel: 'Baix' })] }),
      makePerson('p3', 'XURRO', {}),
    ],
    meta: makeMeta({ distinctPersons: 3, personsWithPlacement: 2, totalPlacements: 3 }),
    ...overrides,
  });

  const setup = async (
    response: EventParticipation = buildResponse(),
    isPast = false,
  ): Promise<ComponentFixture<EventParticipationComponent>> => {
    await TestBed.configureTestingModule({
      imports: [EventParticipationComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        { provide: ParticipationService, useValue: { getByEvent: () => of(response) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EventParticipationComponent);
    fixture.componentRef.setInput('eventId', EVENT_ID);
    fixture.componentRef.setInput('isPast', isPast);
    fixture.detectChanges();
    return fixture;
  };

  const columnByKey = (
    fixture: ComponentFixture<EventParticipationComponent>,
    key: string,
  ): ColumnDef<ParticipationRow> | undefined =>
    fixture.componentInstance.columns().find((c) => c.key === key);

  const pillsOf = (
    fixture: ComponentFixture<EventParticipationComponent>,
    key: string,
    alias: string,
  ): ColumnPill[] => {
    const col = columnByKey(fixture, key);
    const row = fixture.componentInstance.persons().find((p) => p.alias === alias)!;
    return col!.pills!(row);
  };

  describe('columns (per-event scope)', () => {
    it('generates one column per segment, including one nobody is placed in', async () => {
      const response = buildResponse({
        segments: [
          makeSegment(SEG_A, { name: 'Primera', sortOrder: 0 }),
          makeSegment(SEG_B, { name: 'Segona', sortOrder: 1 }),
          makeSegment('seg-empty', { name: 'Buida', sortOrder: 2 }),
        ],
      });
      const fixture = await setup(response);

      expect(columnByKey(fixture, `segment-${SEG_A}`)?.label).toBe('Primera');
      expect(columnByKey(fixture, `segment-${SEG_B}`)?.label).toBe('Segona');
      // An empty column is information: that segment has nobody yet.
      expect(columnByKey(fixture, 'segment-seg-empty')?.label).toBe('Buida');
    });

    it('makes the person column the primary (sticky, card title) one', async () => {
      const fixture = await setup();
      expect(columnByKey(fixture, 'person')?.primary).toBe(true);
    });

    it('hides the full name and tag columns by default to keep the matrix narrow', async () => {
      const fixture = await setup();
      expect(columnByKey(fixture, 'fullName')?.defaultVisible).toBe(false);
      expect(columnByKey(fixture, 'tags')?.defaultVisible).toBe(false);
      expect(fixture.componentInstance.visibleKeys()).not.toContain('fullName');
    });
  });

  describe('cell contents', () => {
    it('renders position with cordon plus the figure name', async () => {
      const fixture = await setup();
      const pills = pillsOf(fixture, `segment-${SEG_A}`, 'PERSIANA');

      expect(pills.map((p) => p.text)).toEqual(['Mans C2', '4d7']);
    });

    it('renders an em dash for a segment the person does nothing in', async () => {
      const fixture = await setup();
      const pills = pillsOf(fixture, `segment-${SEG_B}`, 'GRILLAT');

      expect(pills).toHaveLength(1);
      expect(pills[0].text).toBe('—');
    });

    it('omits the cordon suffix when there is no cordon', async () => {
      const response = buildResponse({
        persons: [makePerson('p1', 'PERSIANA', { [SEG_A]: [makePlacement({ renglaPosition: null })] })],
      });
      const fixture = await setup(response);

      expect(pillsOf(fixture, `segment-${SEG_A}`, 'PERSIANA')[0].text).toBe('Mans');
    });
  });

  describe('per-segment scope', () => {
    it('swaps the segment columns for Figura / Posició / Zona and reseeds the whitelist', async () => {
      const fixture = await setup();
      fixture.componentInstance.onSegmentChange(SEG_A);
      fixture.detectChanges();

      const keys = fixture.componentInstance.columns().map((c) => c.key);
      expect(keys).not.toContain(`segment-${SEG_A}`);
      expect(keys).toEqual(expect.arrayContaining(['segFigure', 'segPosition', 'segZone']));

      // Regression guard: a stale whitelist would render zero columns.
      expect(fixture.componentInstance.visibleKeys()).toEqual(
        expect.arrayContaining(['segFigure', 'segPosition', 'segZone']),
      );
      expect(fixture.componentInstance.visibleKeys()).not.toContain(`segment-${SEG_A}`);
    });

    it('shows the readable zone label, not the raw enum', async () => {
      const fixture = await setup();
      fixture.componentInstance.onSegmentChange(SEG_A);
      fixture.detectChanges();

      expect(pillsOf(fixture, 'segZone', 'PERSIANA')[0].text).toBe('Pinya');
    });

    it('keeps every row: narrowing the scope changes columns, not the population', async () => {
      const fixture = await setup();
      fixture.componentInstance.onSegmentChange(SEG_B);
      fixture.detectChanges();

      expect(fixture.componentInstance.totalRows()).toBe(3);
    });
  });

  describe('search', () => {
    it('matches an alias regardless of accents and case', async () => {
      const response = buildResponse({
        persons: [makePerson('p1', 'PERSIÀNA', {}), makePerson('p2', 'GRILLAT', {})],
      });
      const fixture = await setup(response);

      fixture.componentInstance.search.set('persiana');

      expect(fixture.componentInstance.filteredRows().map((r) => r.alias)).toEqual(['PERSIÀNA']);
    });

    it('ranks an alias prefix above a name substring', async () => {
      const response = buildResponse({
        persons: [
          makePerson('p1', 'ZZZ', {}, { name: 'Marta', firstSurname: 'Mans' }),
          makePerson('p2', 'MARTAM', {}),
        ],
      });
      const fixture = await setup(response);

      fixture.componentInstance.search.set('marta');

      expect(fixture.componentInstance.filteredRows().map((r) => r.alias)).toEqual(['MARTAM', 'ZZZ']);
    });

    /** The point of the feature: "buscar per persones que fa". */
    it('finds people by the figure they are in', async () => {
      const fixture = await setup();

      fixture.componentInstance.search.set('3d7');

      expect(fixture.componentInstance.filteredRows().map((r) => r.alias)).toEqual(['PERSIANA']);
    });

    it('finds people by the position they hold', async () => {
      const fixture = await setup();

      fixture.componentInstance.search.set('baix');

      expect(fixture.componentInstance.filteredRows().map((r) => r.alias)).toEqual(['GRILLAT']);
    });

    it('matches when only the SECOND placement of a cell contains the term', async () => {
      const response = buildResponse({
        persons: [
          makePerson('p1', 'PERSIANA', {
            [SEG_A]: [
              makePlacement({ nodeLabel: 'Mans', figureName: '4d7' }),
              makePlacement({ assignmentId: 'a-9', nodeId: 'n-9', nodeLabel: 'Agulla', figureName: '4d7' }),
            ],
          }),
        ],
      });
      const fixture = await setup(response);

      fixture.componentInstance.search.set('agulla');

      expect(fixture.componentInstance.filteredRows().map((r) => r.alias)).toEqual(['PERSIANA']);
    });
  });

  describe('filters', () => {
    it('narrows by attendance status', async () => {
      const response = buildResponse({
        persons: [
          makePerson('p1', 'PERSIANA', {}, { attendanceStatus: 'ASSISTIT' }),
          makePerson('p2', 'GRILLAT', {}, { attendanceStatus: 'NO_VAIG' }),
        ],
      });
      const fixture = await setup(response);

      fixture.componentInstance.onStatusChange('NO_VAIG');

      expect(fixture.componentInstance.filteredRows().map((r) => r.alias)).toEqual(['GRILLAT']);
    });

    it('derives the tag options from the population, with no extra request', async () => {
      const tag = { id: 't1', name: 'Baix', slug: 'baix', color: '#111', positionTypes: [] };
      const response = buildResponse({
        persons: [
          makePerson('p1', 'PERSIANA', {}, { positions: [tag] }),
          makePerson('p2', 'GRILLAT', {}),
        ],
      });
      const fixture = await setup(response);

      expect(fixture.componentInstance.availablePositions()).toEqual([tag]);

      fixture.componentInstance.onPositionChange('t1');
      expect(fixture.componentInstance.filteredRows().map((r) => r.alias)).toEqual(['PERSIANA']);
    });

    it('lists every active filter as a chip and clears them all at once', async () => {
      const fixture = await setup();

      fixture.componentInstance.search.set('mans');
      fixture.componentInstance.onSegmentChange(SEG_A);
      fixture.componentInstance.onStatusChange('ANIRE');

      expect(fixture.componentInstance.activeFilters().map((f) => f.key)).toEqual(
        expect.arrayContaining(['search', 'segment', 'status']),
      );

      fixture.componentInstance.clearAllFilters();
      expect(fixture.componentInstance.activeFilters()).toEqual([]);
      expect(fixture.componentInstance.page()).toBe(1);
    });

    it('removing the segment chip restores the matrix columns', async () => {
      const fixture = await setup();
      fixture.componentInstance.onSegmentChange(SEG_A);

      fixture.componentInstance.removeFilter('segment');
      fixture.detectChanges();

      expect(fixture.componentInstance.columns().map((c) => c.key)).toContain(`segment-${SEG_A}`);
    });

    it('resets to the first page whenever a filter changes', async () => {
      const fixture = await setup();
      fixture.componentInstance.page.set(3);

      fixture.componentInstance.onStatusChange('ANIRE');

      expect(fixture.componentInstance.page()).toBe(1);
    });
  });

  describe('pagination', () => {
    it('slices the rows and reports the page count', async () => {
      const persons = Array.from({ length: 30 }, (_, i) =>
        makePerson(`p${i}`, `ALIAS${String(i).padStart(2, '0')}`, {}),
      );
      const fixture = await setup(buildResponse({ persons }));

      fixture.componentInstance.onLimitChange(25);

      expect(fixture.componentInstance.totalRows()).toBe(30);
      expect(fixture.componentInstance.pagedRows()).toHaveLength(25);
      expect(fixture.componentInstance.totalPages()).toBe(2);
    });
  });

  // ── The two opposing signalling rules ──────────────────────────────────────

  describe('no warning for legitimate participation', () => {
    it('renders no conflict styling for a person with nothing to do', async () => {
      const fixture = await setup();
      const pills = pillsOf(fixture, `segment-${SEG_A}`, 'XURRO');

      expect(pills.every((p) => !p.class.includes('text-error'))).toBe(true);
      expect(fixture.componentInstance.personLabel(
        fixture.componentInstance.persons().find((p) => p.alias === 'XURRO')!,
      )).toBe('XURRO');
    });

    it('never says anything like "sense assignació" in the rendered panel', async () => {
      const fixture = await setup();
      const text: string = fixture.nativeElement.textContent;

      expect(text.toLowerCase()).not.toContain('sense assignació');
      expect(fixture.nativeElement.querySelector('[data-testid="participation-conflict-counter"]')).toBeFalsy();
    });

    it('does not warn about someone who declined but is still placed', async () => {
      const response = buildResponse({
        persons: [
          makePerson('p1', 'XURRO', { [SEG_A]: [makePlacement()] }, { attendanceStatus: 'NO_VAIG' }),
        ],
      });
      const fixture = await setup(response);

      expect(pillsOf(fixture, `segment-${SEG_A}`, 'XURRO').every((p) => !p.class.includes('text-error'))).toBe(true);
    });
  });

  describe('conflict styling for conflicts (one person, two places at once)', () => {
    const conflictResponse = () =>
      buildResponse({
        persons: [
          makePerson('p1', 'PERSIANA', {
            [SEG_A]: [
              makePlacement({ nodeLabel: 'Mans', figureName: '4d7', renglaPosition: 2 }),
              makePlacement({ assignmentId: 'a-9', nodeId: 'n-9', nodeLabel: 'Vent', figureName: '4d7', renglaPosition: 1 }),
            ],
          }),
          makePerson('p2', 'GRILLAT', { [SEG_A]: [makePlacement({ assignmentId: 'a-3', nodeId: 'n-3' })] }),
        ],
        meta: makeMeta({ distinctPersons: 2, personsWithPlacement: 2, totalPlacements: 3, conflictedPersons: 1 }),
      });

    it('styles every pill of the duplicated cell as conflict, glyph first', async () => {
      const fixture = await setup(conflictResponse());
      const pills = pillsOf(fixture, `segment-${SEG_A}`, 'PERSIANA');

      expect(pills[0].text).toBe('‼');
      expect(pills.every((p) => p.class.includes('text-error'))).toBe(true);
      expect(pills.map((p) => p.text).slice(1)).toEqual(['Mans C2 · 4d7', 'Vent C1 · 4d7']);
    });

    it('leaves the non-conflicted person in the same segment unstyled', async () => {
      const fixture = await setup(conflictResponse());

      expect(pillsOf(fixture, `segment-${SEG_A}`, 'GRILLAT').every((p) => !p.class.includes('text-error'))).toBe(true);
    });

    it('shows the header counter, which does not depend on horizontal scrolling', async () => {
      const fixture = await setup(conflictResponse());

      expect(fixture.componentInstance.hasConflicts()).toBe(true);
      expect(fixture.componentInstance.conflictLine()).toBe('1 persona en dos llocs alhora');
      expect(
        fixture.nativeElement.querySelector('[data-testid="participation-conflict-counter"]'),
      ).toBeTruthy();
    });

    /** The `person` column's sticky/primary cell renders this glyph in the theme's error
     *  color, independent of `personLabel`'s own plain-text string (see the pure-unit tests
     *  above) — the only one of the three per-row marks that also survives horizontal
     *  scrolling, since this is the sticky column. */
    it('marks a conflicted person with a coloured prefix on the primary column', async () => {
      const fixture = await setup(conflictResponse());
      const persiana = fixture.componentInstance.persons().find((p) => p.alias === 'PERSIANA')!;
      const personColumn = fixture.componentInstance.columns().find((c) => c.key === 'person')!;

      expect(personColumn.prefix?.(persiana)).toEqual({ text: '‼', class: 'text-error font-bold' });
    });

    it('does not mark a non-conflicted person with the prefix', async () => {
      const fixture = await setup(conflictResponse());
      const grillat = fixture.componentInstance.persons().find((p) => p.alias === 'GRILLAT')!;
      const personColumn = fixture.componentInstance.columns().find((c) => c.key === 'person')!;

      expect(personColumn.prefix?.(grillat)).toBeNull();
    });

    it('pluralises the counter', async () => {
      const response = conflictResponse();
      response.meta.conflictedPersons = 2;
      const fixture = await setup(response);

      expect(fixture.componentInstance.conflictLine()).toBe('2 persones en dos llocs alhora');
    });

    it('filters down to the conflicted rows from the counter', async () => {
      const fixture = await setup(conflictResponse());

      fixture.componentInstance.toggleOnlyConflicts();

      expect(fixture.componentInstance.filteredRows().map((r) => r.alias)).toEqual(['PERSIANA']);
      expect(fixture.componentInstance.activeFilters().map((f) => f.key)).toContain('conflicts');
    });

    it('warns in the per-segment scope too', async () => {
      const fixture = await setup(conflictResponse());
      fixture.componentInstance.onSegmentChange(SEG_A);
      fixture.detectChanges();

      const positions = pillsOf(fixture, 'segPosition', 'PERSIANA');
      expect(positions.map((p) => p.text)).toEqual(['Mans C2', 'Vent C1']);
      expect(positions.every((p) => p.class.includes('text-error'))).toBe(true);
    });

    /** Placements in DIFFERENT segments are legal: the person is in two places at
     *  different times, not at once. Getting this wrong (`placementCount > 1`) would
     *  flag most of the colla. */
    it('does NOT warn about placements spread across different segments', async () => {
      const fixture = await setup();
      const persiana = fixture.componentInstance.persons().find((p) => p.alias === 'PERSIANA')!;

      expect(persiana.placementCount).toBe(2);
      expect(persiana.conflictSegmentIds).toEqual([]);
      expect(fixture.componentInstance.hasConflicts()).toBe(false);
      expect(fixture.componentInstance.personLabel(persiana)).not.toContain('‼');
      expect(pillsOf(fixture, `segment-${SEG_A}`, 'PERSIANA').every((p) => !p.class.includes('text-error'))).toBe(true);
    });
  });

  describe('navigation', () => {
    it('opens the person detail on row click', async () => {
      const fixture = await setup();
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.componentInstance.navigateToPerson(
        fixture.componentInstance.persons().find((p) => p.alias === 'PERSIANA')!,
      );

      expect(navigate).toHaveBeenCalledWith(['/persons', 'p1']);
    });

    it('offers one workshop action per segment, hidden where the person is not placed', async () => {
      const fixture = await setup();
      const actions = fixture.componentInstance.rowActions();
      const xurro = fixture.componentInstance.persons().find((p) => p.alias === 'XURRO')!;
      const grillat = fixture.componentInstance.persons().find((p) => p.alias === 'GRILLAT')!;

      expect(actions).toHaveLength(2);
      expect(actions.every((a) => a.hidden!(xurro))).toBe(true);
      expect(actions[0].hidden!(grillat)).toBe(false);
      expect(actions[1].hidden!(grillat)).toBe(true);
    });

    it('navigates into the assignment workshop with a returnUrl back to this tab', async () => {
      const fixture = await setup();
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'url', 'get').mockReturnValue('/events/event-1?tab=participacio');
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      const persiana = fixture.componentInstance.persons().find((p) => p.alias === 'PERSIANA')!;
      fixture.componentInstance.rowActions()[0].action(persiana);

      expect(navigate).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', SEG_A, 'assign', 'inst-1'],
        { queryParams: { returnUrl: '/events/event-1?tab=participacio', tab: 'pinyes' } },
      );
    });

    it('flags a past event so the workshop opens read-only', async () => {
      const fixture = await setup(buildResponse(), true);
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'url', 'get').mockReturnValue('/events/event-1?tab=participacio');
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      const persiana = fixture.componentInstance.persons().find((p) => p.alias === 'PERSIANA')!;
      fixture.componentInstance.rowActions()[0].action(persiana);

      expect(navigate).toHaveBeenCalledWith(
        expect.anything(),
        { queryParams: { returnUrl: '/events/event-1?tab=participacio', tab: 'pinyes', past: '1' } },
      );
    });

    it('restricts the actions to the chosen segment when scoped', async () => {
      const fixture = await setup();
      fixture.componentInstance.onSegmentChange(SEG_B);

      expect(fixture.componentInstance.rowActions()).toHaveLength(1);
    });
  });

  describe('area filter (Fase 6)', () => {
    /** PERSIANA: tronc + pinya in SEG_A (TRONC_PINYA), plain pinya in SEG_B. */
    const areaResponse = () =>
      buildResponse({
        persons: [
          makePerson('p1', 'PERSIANA', {
            [SEG_A]: [
              makeTroncPlacement({ assignmentId: 'a-t1', nodeId: 'n-t1' }),
              makePlacement({ assignmentId: 'a-p1', nodeId: 'n-p1' }),
            ],
            [SEG_B]: [makePlacement({ assignmentId: 'a-p2', nodeId: 'n-p2' })],
          }),
          makePerson('p2', 'GRILLAT', { [SEG_A]: [makePlacement({ assignmentId: 'a-3', nodeId: 'n-3' })] }),
        ],
        meta: makeMeta({ distinctPersons: 2, personsWithPlacement: 2, totalPlacements: 4, conflictedPersons: 1 }),
      });

    it('shows only tronc placements with "Només troncs"', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onAreaChange('TRONC');
      fixture.detectChanges();

      const pills = pillsOf(fixture, `segment-${SEG_A}`, 'PERSIANA');
      expect(pills.map((p) => p.text)).toEqual(['‼', 'Segona · 4d7']);
      expect(pillsOf(fixture, `segment-${SEG_B}`, 'PERSIANA')).toEqual([{ text: '—', class: expect.any(String) }]);
    });

    it('shows only pinya placements with "Només pinyes"', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onAreaChange('PINYA');
      fixture.detectChanges();

      const pills = pillsOf(fixture, `segment-${SEG_A}`, 'PERSIANA');
      expect(pills.map((p) => p.text)).toEqual(['‼', 'Mans C2 · 4d7']);
    });

    it('restores the whole matrix with "Tota l\'àrea"', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onAreaChange('TRONC');
      fixture.componentInstance.onAreaChange('');
      fixture.detectChanges();

      expect(pillsOf(fixture, `segment-${SEG_A}`, 'PERSIANA')).toHaveLength(3);
    });

    it('keeps the conflict marked even when the filter only paints one of its two placements', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onAreaChange('TRONC');
      fixture.detectChanges();

      const pills = pillsOf(fixture, `segment-${SEG_A}`, 'PERSIANA');
      expect(pills.every((p) => p.class.includes('text-error'))).toBe(true);
    });

    it('does not touch the row-level conflict prefix, which is event-wide', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onAreaChange('PINYA');

      const persiana = fixture.componentInstance.persons().find((p) => p.alias === 'PERSIANA')!;
      const personColumn = fixture.componentInstance.columns().find((c) => c.key === 'person')!;
      expect(personColumn.prefix?.(persiana)).toEqual({ text: '‼', class: 'text-error font-bold' });
    });

    it('excludes DIRECTION placements from both "Només troncs" and "Només pinyes"', async () => {
      const response = buildResponse({
        persons: [
          makePerson('p1', 'DIRECTORA', {
            [SEG_A]: [makePlacement({ zone: 'FIGURE_DIRECTION', area: 'DIRECTION', nodeLabel: 'Direcció' })],
          }),
        ],
      });
      const fixture = await setup(response);

      fixture.componentInstance.onAreaChange('TRONC');
      fixture.detectChanges();
      expect(pillsOf(fixture, `segment-${SEG_A}`, 'DIRECTORA')).toEqual([{ text: '—', class: expect.any(String) }]);

      fixture.componentInstance.onAreaChange('PINYA');
      fixture.detectChanges();
      expect(pillsOf(fixture, `segment-${SEG_A}`, 'DIRECTORA')).toEqual([{ text: '—', class: expect.any(String) }]);
    });

    it('renders an em dash for a cell left empty by the filter', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onAreaChange('TRONC');
      fixture.detectChanges();

      expect(pillsOf(fixture, `segment-${SEG_B}`, 'GRILLAT')).toEqual([{ text: '—', class: expect.any(String) }]);
    });

    it('applies the filter to per-segment scope columns too', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onSegmentChange(SEG_A);
      fixture.componentInstance.onAreaChange('TRONC');
      fixture.detectChanges();

      const zonePills = pillsOf(fixture, 'segZone', 'PERSIANA');
      expect(zonePills.map((p) => p.text)).toEqual(['Tronc']);
      expect(zonePills.every((p) => p.class.includes('text-error'))).toBe(true);
    });

    it('lists the filter as a chip and clears it from there', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onAreaChange('TRONC');

      expect(fixture.componentInstance.activeFilters().map((f) => f.key)).toContain('area');

      fixture.componentInstance.removeFilter('area');
      expect(fixture.componentInstance.areaFilter()).toBeNull();
    });

    it('clears the area filter with clearAllFilters', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onAreaChange('PINYA');

      fixture.componentInstance.clearAllFilters();

      expect(fixture.componentInstance.areaFilter()).toBeNull();
    });

    it('resets to the first page when the area filter changes', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.page.set(3);

      fixture.componentInstance.onAreaChange('TRONC');

      expect(fixture.componentInstance.page()).toBe(1);
    });

    it('hides the row action for a segment with nothing left after filtering', async () => {
      const fixture = await setup(areaResponse());
      fixture.componentInstance.onAreaChange('TRONC');

      const grillat = fixture.componentInstance.persons().find((p) => p.alias === 'GRILLAT')!;
      // GRILLAT only has a pinya placement in SEG_A — filtering to TRONC leaves nothing.
      expect(fixture.componentInstance.rowActions()[0].hidden!(grillat)).toBe(true);
    });
  });

  describe('tronc column (Fase 6)', () => {
    it('is not visible by default and only exists in per-event scope', async () => {
      const fixture = await setup();

      expect(columnByKey(fixture, 'troncDetail')).toBeDefined();
      expect(fixture.componentInstance.visibleKeys()).not.toContain('troncDetail');

      fixture.componentInstance.onSegmentChange(SEG_A);
      fixture.detectChanges();
      expect(columnByKey(fixture, 'troncDetail')).toBeUndefined();
    });

    it('consolidates tronc placements across several segments, prefixed by segment and in order', async () => {
      const response = buildResponse({
        persons: [
          makePerson('p1', 'PERSIANA', {
            [SEG_A]: [makeTroncPlacement({ assignmentId: 'a-t1', nodeLabel: 'Base 1' })],
            [SEG_B]: [makeTroncPlacement({ assignmentId: 'a-t2', nodeLabel: 'Xiqueta' })],
          }),
        ],
      });
      const fixture = await setup(response);

      const pills = pillsOf(fixture, 'troncDetail', 'PERSIANA');
      expect(pills.map((p) => p.text)).toEqual(['Primera: Base 1 · 4d7', 'Segona: Xiqueta · 4d7']);
    });

    it('includes BASE (D10) and excludes PINYA', async () => {
      const response = buildResponse({
        persons: [
          makePerson('p1', 'PERSIANA', {
            [SEG_A]: [
              makeTroncPlacement({ assignmentId: 'a-base', zone: 'BASE', area: 'TRONC', nodeLabel: 'Base 1' }),
              makePlacement({ assignmentId: 'a-pinya', nodeLabel: 'Mans' }),
            ],
          }),
        ],
      });
      const fixture = await setup(response);

      const pills = pillsOf(fixture, 'troncDetail', 'PERSIANA');
      expect(pills.map((p) => p.text)).toEqual(['Primera: Base 1 · 4d7']);
    });

    it('renders an em dash for someone with no tronc anywhere in the event', async () => {
      const fixture = await setup();
      expect(pillsOf(fixture, 'troncDetail', 'XURRO')).toEqual([{ text: '—', class: expect.any(String) }]);
    });

    it('does not react to the area filter', async () => {
      const response = buildResponse({
        persons: [
          makePerson('p1', 'PERSIANA', { [SEG_A]: [makeTroncPlacement({ assignmentId: 'a-t1' })] }),
        ],
      });
      const fixture = await setup(response);

      const withoutFilter = pillsOf(fixture, 'troncDetail', 'PERSIANA');
      fixture.componentInstance.onAreaChange('PINYA');
      fixture.detectChanges();
      const withFilter = pillsOf(fixture, 'troncDetail', 'PERSIANA');

      expect(withFilter).toEqual(withoutFilter);
    });

    it('styles two troncs in the SAME segment as a conflict but two in different segments as normal', async () => {
      const response = buildResponse({
        persons: [
          makePerson('p1', 'CONFLICTIVA', {
            [SEG_A]: [
              makeTroncPlacement({ assignmentId: 'a-t1', nodeLabel: 'Base 1' }),
              makeTroncPlacement({ assignmentId: 'a-t2', nodeId: 'n-t2', nodeLabel: 'Base 2' }),
            ],
          }),
          makePerson('p2', 'NORMAL', {
            [SEG_A]: [makeTroncPlacement({ assignmentId: 'a-t3', nodeLabel: 'Base 1' })],
            [SEG_B]: [makeTroncPlacement({ assignmentId: 'a-t4', nodeLabel: 'Base 2' })],
          }),
        ],
      });
      const fixture = await setup(response);

      expect(pillsOf(fixture, 'troncDetail', 'CONFLICTIVA').every((p) => p.class.includes('text-error'))).toBe(true);
      expect(pillsOf(fixture, 'troncDetail', 'NORMAL').every((p) => !p.class.includes('text-error'))).toBe(true);
    });
  });

  describe('load metrics (Fase 6)', () => {
    const loadResponse = () =>
      buildResponse({
        segments: [makeSegment(SEG_A, { name: 'Primera', sortOrder: 0 }), makeSegment(SEG_B, { name: 'Segona', sortOrder: 1 })],
        persons: [
          makePerson('p1', 'AAA', { [SEG_A]: [makePlacement()], [SEG_B]: [makePlacement({ assignmentId: 'a-2' })] }),
          makePerson('p2', 'BBB', { [SEG_A]: [makeTroncPlacement({ assignmentId: 'a-3' })] }),
          makePerson('p3', 'CCC', {}),
        ],
        meta: makeMeta({ distinctPersons: 3, personsWithPlacement: 2, totalPlacements: 3 }),
      });

    it('exposes placementCount, troncPlacementCount and % segments as columns', async () => {
      const fixture = await setup(loadResponse());
      const aaa = fixture.componentInstance.persons().find((p) => p.alias === 'AAA')!;

      expect(columnByKey(fixture, 'placementCount')?.value!(aaa)).toBe(2);
      expect(columnByKey(fixture, 'troncPlacementCount')?.value!(aaa)).toBe(0);
      expect(columnByKey(fixture, 'segmentPercent')?.value!(aaa)).toBe('100%');
    });

    it('sorts by placementCount in both directions', async () => {
      const fixture = await setup(loadResponse());

      fixture.componentInstance.onSortChange({ field: 'placements', order: 'DESC' });
      expect(fixture.componentInstance.sortedRows().map((r) => r.alias)).toEqual(['AAA', 'BBB', 'CCC']);

      fixture.componentInstance.onSortChange({ field: 'placements', order: 'ASC' });
      expect(fixture.componentInstance.sortedRows().map((r) => r.alias)).toEqual(['CCC', 'BBB', 'AAA']);
    });

    it('sorts by troncPlacementCount', async () => {
      const fixture = await setup(loadResponse());

      fixture.componentInstance.onSortChange({ field: 'troncPlacements', order: 'DESC' });
      expect(fixture.componentInstance.sortedRows()[0].alias).toBe('BBB');
    });

    it('sorts by segmentPercent', async () => {
      const fixture = await setup(loadResponse());

      fixture.componentInstance.onSortChange({ field: 'segmentPercent', order: 'DESC' });
      expect(fixture.componentInstance.sortedRows()[0].alias).toBe('AAA');
    });

    it('a search term still wins over a column sort', async () => {
      const fixture = await setup(loadResponse());
      fixture.componentInstance.onSortChange({ field: 'placements', order: 'DESC' });

      fixture.componentInstance.search.set('ccc');

      expect(fixture.componentInstance.sortedRows().map((r) => r.alias)).toEqual(['CCC']);
    });

    it('computes min/mean/max placement load and the count of unplaced persons', async () => {
      const fixture = await setup(loadResponse());

      expect(fixture.componentInstance.loadLine()).toBe('Càrrega: mín 0 · mitjana 1.0 · màx 2 · 1 sense cap col·locació');
    });

    it('omits the unplaced clause once everyone has at least one placement', async () => {
      const response = loadResponse();
      response.persons = response.persons.filter((p) => p.alias !== 'CCC');
      response.meta = makeMeta({ distinctPersons: 2, personsWithPlacement: 2, totalPlacements: 3 });
      const fixture = await setup(response);

      expect(fixture.componentInstance.loadLine()).not.toContain('sense cap col·locació');
    });

    it('returns 0%, not NaN, when the event has no segments', async () => {
      const fixture = await setup(loadResponse());
      const aaa = fixture.componentInstance.persons().find((p) => p.alias === 'AAA')!;

      expect(fixture.componentInstance.segmentPercent({ ...aaa, assignedSegmentCount: 0 })).toBe(0);
      fixture.componentInstance.segments.set([]);
      expect(fixture.componentInstance.segmentPercent(aaa)).toBe(0);
    });

    it('renders no load line for an empty population', async () => {
      const fixture = await setup(buildResponse({ persons: [], meta: makeMeta() }));
      expect(fixture.componentInstance.loadLine()).toBeNull();
    });
  });

  describe('empty and error states', () => {
    it('renders the empty state and no table when nobody participates', async () => {
      const fixture = await setup(
        buildResponse({
          persons: [],
          meta: makeMeta(),
        }),
      );

      expect(fixture.nativeElement.querySelector('lib-empty-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-data-table')).toBeFalsy();
    });

    it('offers a retry when the request fails', async () => {
      await TestBed.configureTestingModule({
        imports: [EventParticipationComponent],
        providers: [
          provideRouter([]),
          allLucideIconsProvider,
          {
            provide: ParticipationService,
            useValue: { getByEvent: () => throwError(() => new Error('boom')) },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(EventParticipationComponent);
      fixture.componentRef.setInput('eventId', EVENT_ID);
      fixture.detectChanges();

      expect(fixture.componentInstance.loadError()).toBe(true);
      expect(fixture.nativeElement.querySelector('.alert-error')).toBeTruthy();
      expect(fixture.componentInstance.loading()).toBe(false);
    });
  });
});
