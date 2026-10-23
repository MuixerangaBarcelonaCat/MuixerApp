import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonHoverCardComponent } from './person-hover-card.component';
import { AvailablePersonPosition, PersonHoverInfo } from '../../models/assignment.model';
import { TagCategory } from '@muixer/shared';
import { signal } from '@angular/core';
import { DEFAULT_COLLA_SETTINGS } from '@muixer/shared';
import { PINYES_RENDER_SETTINGS } from '../../settings/render-settings';

const makeInfo = (overrides: Partial<PersonHoverInfo> = {}): PersonHoverInfo => ({
  alias: 'Pepet',
  attendanceStatus: 'ANIRE',
  isXicalla: false,
  shoulderHeight: null,
  notes: null,
  notesEmoji: null,
  positions: [],
  ...overrides,
});

const posVents: AvailablePersonPosition = { id: 'pos-vents', name: 'Vents', slug: 'vents', color: '#A5D6A7', category: TagCategory.ALTRES, positionTypes: ['vents'] };
const posAgulla: AvailablePersonPosition = { id: 'pos-agulla', name: 'Agulla', slug: 'agulla', color: '#0d9488', category: TagCategory.ALTRES, positionTypes: ['agulla'] };

describe('PersonHoverCardComponent', () => {
  let fixture: ComponentFixture<PersonHoverCardComponent>;
  let component: PersonHoverCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonHoverCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonHoverCardComponent);
    component = fixture.componentInstance;
  });

  it('creates successfully', () => {
    fixture.componentRef.setInput('info', makeInfo());
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('marks a xicalla with the xicalla icon, not an emoji', () => {
    fixture.componentRef.setInput('info', makeInfo({ isXicalla: true }));
    fixture.detectChanges();
    const mark: HTMLElement = fixture.nativeElement.querySelector('[aria-label="Xicalla"]');
    expect(mark.querySelector('svg')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('👶');
  });

  it('shows a tag with no color of its own as a neutral badge, not in a made-up gray', () => {
    const uncolored: AvailablePersonPosition = { ...posVents, id: 'pos-x', color: null };
    fixture.componentRef.setInput('info', makeInfo({ positions: [uncolored] }));
    fixture.detectChanges();
    const tag = [...fixture.nativeElement.querySelectorAll('lib-badge .badge')].find((b: HTMLElement) =>
      b.textContent?.includes('Vents'),
    ) as HTMLElement;
    expect(tag.classList).toContain('badge-neutral');
    expect(tag.style.backgroundColor).toBe('');
  });

  it("shows the relative height from the colla's baseline", () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PersonHoverCardComponent],
      providers: [
        {
          provide: PINYES_RENDER_SETTINGS,
          useValue: signal({ shoulderHeightBaselineCm: 130, troncHeightThresholds: DEFAULT_COLLA_SETTINGS.troncHeightThresholds }),
        },
      ],
    });
    const card = TestBed.createComponent(PersonHoverCardComponent);
    card.componentRef.setInput('info', makeInfo({ shoulderHeight: 135 }));
    card.componentRef.setInput('heightMode', 'relative');

    expect(card.componentInstance.formatHeight()).toBe('+5');
  });

  describe('cumulative height', () => {
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

    it('shows the cumulative height when it is known', () => {
      fixture.componentRef.setInput('info', makeInfo({ shoulderHeight: 130, cumulativeHeight: 431 }));
      fixture.detectChanges();
      expect(text()).toContain('Alçada acumulada: 431 cm');
    });

    it.each([null, undefined])('shows nothing when it is %s', (cumulativeHeight) => {
      fixture.componentRef.setInput('info', makeInfo({ shoulderHeight: 130, cumulativeHeight }));
      fixture.detectChanges();
      expect(text()).not.toContain('acumulada');
    });
  });

  describe('without an active node position type', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('info', makeInfo({ positions: [posAgulla, posVents] }));
      fixture.detectChanges();
    });

    it('keeps the original position order', () => {
      expect(component.sortedPositions().map((p) => p.id)).toEqual(['pos-agulla', 'pos-vents']);
    });

    it('treats every tag as a match', () => {
      expect(component.isPositionMatch(posAgulla)).toBe(true);
      expect(component.isPositionMatch(posVents)).toBe(true);
    });
  });

  describe('with an active node position type', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('info', makeInfo({ positions: [posAgulla, posVents] }));
      fixture.componentRef.setInput('activeNodePositionType', 'vents');
      fixture.detectChanges();
    });

    it('promotes the matching tag first', () => {
      expect(component.sortedPositions().map((p) => p.id)).toEqual(['pos-vents', 'pos-agulla']);
    });

    it('flags only the matching tag as a match', () => {
      expect(component.isPositionMatch(posVents)).toBe(true);
      expect(component.isPositionMatch(posAgulla)).toBe(false);
    });

    it('renders the matching tag at full opacity and the rest faded', () => {
      // lib-badge's own host is display:contents (no box of its own, but still a real DOM node
      // between the wrapper and the rendered .badge span) — the opacity toggle lives two levels
      // up, on the wrapping <span>.
      const badges: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.badge'));
      const filled = badges.find((b) => b.textContent?.trim() === 'Vents');
      const faded = badges.find((b) => b.textContent?.trim() === 'Agulla');

      expect(filled?.parentElement?.parentElement?.classList.contains('opacity-50')).toBe(false);
      expect(faded?.parentElement?.parentElement?.classList.contains('opacity-50')).toBe(true);
    });
  });

  describe('attendance status', () => {
    it.each([
      ['before', 'ANIRE', 'Ve', 'success'],
      ['day', 'ASSISTIT', 'Ha arribat', 'success'],
      ['day', 'ANIRE', 'Ve', 'success'],
      ['day', 'NO_VAIG', 'No vindrà', 'error'],
      ['started', 'ASSISTIT', 'Ha arribat', 'success'],
      ['started', 'ANIRE', 'No ha arribat', 'warning'],
      ['started', 'NO_VAIG', 'No vindrà', 'error'],
      ['after', 'ASSISTIT', 'Va vindre', 'success'],
      ['after', 'ANIRE', 'No presentat', 'warning'],
      ['after', 'PENDENT', 'Sense resposta', 'ghost'],
    ] as const)('%s / %s → "%s" (%s)', (phase, status, label, variant) => {
      fixture.componentRef.setInput('info', makeInfo({ attendanceStatus: status }));
      fixture.componentRef.setInput('phase', phase);
      expect(component.statusLabel()).toBe(label);
      expect(component.statusBadgeVariant()).toBe(variant);
    });
  });
});
