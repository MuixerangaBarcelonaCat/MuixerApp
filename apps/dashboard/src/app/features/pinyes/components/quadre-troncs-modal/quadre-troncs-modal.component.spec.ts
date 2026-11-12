import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TagCategory } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { ParticipationService } from '../../../events/services/participation.service';
import { TagService } from '../../../config/services/tag.service';
import { EventParticipation, ParticipationPerson } from '../../../events/models/participation.model';
import { QuadreTroncsModalComponent } from './quadre-troncs-modal.component';

const TAGS = [
  { id: 't-mans', name: '1es Mans', slug: 'mans' },
  { id: 't-terca', name: 'Terces', slug: 'terca' },
  { id: 't-alca', name: 'Alçadores', slug: 'alcadora' },
].map((t) => ({ ...t, category: TagCategory.TRONC, color: null, positionTypes: [], personCount: 0 }));

const pos = (id: string) => {
  const t = TAGS.find((x) => x.id === id)!;
  return { id: t.id, name: t.name, slug: t.slug, color: null, positionTypes: [], category: TagCategory.TRONC };
};

const placement = (instanceId: string) => ({
  assignmentId: `a-${instanceId}`,
  instanceId,
  figureName: 'F',
  nodeId: `n-${instanceId}`,
  nodeLabel: 'N',
  zone: 'TRONC',
  area: 'TRONC' as const,
  positionType: 'segona',
  z: 1,
  renglaPosition: null,
});

function person(id: string, overrides: Partial<ParticipationPerson>): ParticipationPerson {
  return {
    id,
    alias: id.toUpperCase(),
    name: 'Nom',
    firstSurname: 'Cognom',
    shoulderHeight: 150,
    isXicalla: false,
    isActive: true,
    notes: null,
    notesEmoji: null,
    attendanceStatus: 'ANIRE',
    nextPerformanceStatus: 'PENDENT',
    positions: [],
    placements: {},
    assignedSegmentCount: 0,
    placementCount: 0,
    troncPlacementCount: 0,
    conflictSegmentIds: [],
    ...overrides,
  };
}

// MONICA wears two column tags; ROSER is coming to both and has done 2 figures;
// ABSENT holds a placement but declined.
const PERSONS = [
  person('monica', { positions: [pos('t-terca'), pos('t-alca')] }),
  person('roser', {
    positions: [pos('t-mans')],
    nextPerformanceStatus: 'ANIRE',
    placements: { s1: [placement('i1')], s2: [placement('i2')] },
  }),
  person('absent', { positions: [pos('t-mans')], attendanceStatus: 'NO_VAIG', placements: { s1: [placement('i1')] } }),
];

const OVERVIEW = {
  event: { id: 'ev1', title: 'Assaig de dijous', date: '2026-11-12' },
  segments: [],
  persons: PERSONS,
  nextPerformance: { id: 'ac1', title: 'Actuació', date: '2026-11-20' },
  meta: {},
} as unknown as EventParticipation;

describe('QuadreTroncsModalComponent', () => {
  let fixture: ComponentFixture<QuadreTroncsModalComponent>;
  let getByEvent: ReturnType<typeof vi.fn>;

  async function setup(response = of(OVERVIEW)) {
    localStorage.clear();
    getByEvent = vi.fn().mockReturnValue(response);
    await TestBed.configureTestingModule({
      imports: [QuadreTroncsModalComponent],
      providers: [
        allLucideIconsProvider,
        { provide: ParticipationService, useValue: { getByEvent } },
        { provide: TagService, useValue: { getAll: () => of(TAGS) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(QuadreTroncsModalComponent);
    fixture.componentRef.setInput('eventId', 'ev1');
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const columnHeaders = () =>
    Array.from(el().querySelectorAll('[data-testid="quadre-column-name"]')).map((n) => n.textContent?.trim());
  const rowsOf = (alias: string) => Array.from(el().querySelectorAll<HTMLElement>(`[data-person-alias="${alias}"]`));

  it('requests the participation with next-performance attendees', async () => {
    await setup();
    expect(getByEvent).toHaveBeenCalledWith('ev1', { includeNextPerformance: true });
  });

  it('renders the default columns that exist, then «Altres»', async () => {
    await setup();
    expect(columnHeaders()).toEqual(['1es Mans', 'Alçadores', 'Terces', 'Altres']);
  });

  it('shows the unique count of people coming in the header', async () => {
    await setup();
    expect(el().querySelector('[data-testid="quadre-total"]')?.textContent).toContain('2');
  });

  it('repeats a multi-tag person in each column', async () => {
    await setup();
    expect(rowsOf('MONICA')).toHaveLength(2);
  });

  it('colours a person coming to both and shows their dots and star', async () => {
    await setup();
    const [roser] = rowsOf('ROSER');
    expect(roser.dataset['state']).toBe('both');
    expect(roser.textContent).toContain('●●');
    expect(roser.querySelector('[data-testid="quadre-next-performance"]')).not.toBeNull();
  });

  it('flags an assigned person who is not coming', async () => {
    await setup();
    const [absent] = rowsOf('ABSENT');
    expect(absent.dataset['state']).toBe('assignedAbsent');
    expect(absent.querySelector('[data-testid="quadre-assigned-absent"]')).not.toBeNull();
  });

  it('highlights every appearance of the hovered person', async () => {
    await setup();
    rowsOf('MONICA')[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(rowsOf('MONICA').every((r) => r.dataset['highlighted'] === 'true')).toBe(true);
    expect(rowsOf('ROSER')[0].dataset['highlighted']).toBe('false');
  });

  it('«Només qui no ha participat» hides people with figures but keeps the total', async () => {
    await setup();
    fixture.componentInstance.onlyUnplaced.set(true);
    fixture.detectChanges();
    expect(rowsOf('ROSER')).toHaveLength(0);
    expect(rowsOf('MONICA')).toHaveLength(2);
    expect(el().querySelector('[data-testid="quadre-total"]')?.textContent).toContain('2');
  });

  it('words the total for any event type, singular included', async () => {
    await setup(of({ ...OVERVIEW, persons: [PERSONS[0]] }));
    const total = el().querySelector('[data-testid="quadre-total"]')?.textContent?.trim();
    expect(total).toBe('1 persona ve');
  });

  it('words the plural total without naming the event type', async () => {
    await setup();
    expect(el().querySelector('[data-testid="quadre-total"]')?.textContent?.trim()).toBe('2 persones vénen');
  });

  it('tells assistive tech whether the columns panel is open', async () => {
    await setup();
    const button = () => el().querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(button().getAttribute('aria-expanded')).toBe('false');
    button().click();
    fixture.detectChanges();
    expect(button().getAttribute('aria-expanded')).toBe('true');
  });

  it('shows an alert when loading fails', async () => {
    await setup(throwError(() => new Error('boom')));
    expect(el().querySelector('lib-alert')).not.toBeNull();
  });
});
