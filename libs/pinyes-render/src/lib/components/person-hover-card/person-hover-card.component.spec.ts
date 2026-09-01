import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonHoverCardComponent } from './person-hover-card.component';
import { AvailablePersonPosition, PersonHoverInfo } from '../../models/assignment.model';
import { TagCategory } from '@muixer/shared';

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
});
