import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ShirtCandidate } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { ShirtCandidatesComponent } from './shirt-candidates.component';
import { PersonService } from '../../services/person.service';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';

const makeCandidate = (overrides: Partial<ShirtCandidate> = {}): ShirtCandidate => ({
  id: 'p1',
  alias: 'Pepa',
  name: 'Josefa',
  firstSurname: 'Martí',
  secondSurname: null,
  isXicalla: false,
  joinDate: null,
  performancesAttended: 2,
  rehearsalsAttended: 6,
  lastAttendedDate: '2026-10-01',
  isEligible: true,
  missingTotal: 0,
  ...overrides,
});

describe('ShirtCandidatesComponent', () => {
  let fixture: ComponentFixture<ShirtCandidatesComponent>;
  let component: ShirtCandidatesComponent;
  let mockPersonService: {
    getShirtCandidates: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockToast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const eligible = makeCandidate({ id: 'e1', alias: 'Dret' });
  const inProgress = makeCandidate({
    id: 'c1',
    alias: 'Encara',
    performancesAttended: 1,
    rehearsalsAttended: 4,
    isEligible: false,
    missingTotal: 3,
  });

  const text = (selector: string): string =>
    (fixture.nativeElement.querySelector(selector) as HTMLElement | null)?.textContent ?? '';

  beforeEach(async () => {
    mockPersonService = {
      getShirtCandidates: vi.fn().mockReturnValue(of([eligible, inProgress])),
      update: vi.fn().mockReturnValue(of({})),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ShirtCandidatesComponent],
      providers: [
        allLucideIconsProvider,
        provideRouter([]),
        { provide: PersonService, useValue: mockPersonService },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShirtCandidatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('splits eligible persons from those still in progress', () => {
    expect(text('[data-testid="shirt-eligible"]')).toContain('Dret');
    expect(text('[data-testid="shirt-eligible"]')).not.toContain('Encara');
    expect(text('[data-testid="shirt-in-progress"]')).toContain('Encara');
    expect(text('[data-testid="shirt-in-progress"]')).not.toContain('Dret');
  });

  it('shows the count of each event type against the requirement', () => {
    const row = text('[data-testid="shirt-row-c1"]');
    expect(row).toContain('1/2');
    expect(row).toContain('4/6');
  });

  it('draws one circle per required event with the event-type icon inside, filled for each attended', () => {
    const row = fixture.nativeElement.querySelector('[data-testid="shirt-row-c1"]') as HTMLElement;
    const marks = Array.from(row.querySelectorAll('[data-pip]'));

    expect(marks).toHaveLength(8);
    expect(marks.filter((m) => m.getAttribute('data-pip') === 'met')).toHaveLength(5);
    expect(marks.every((m) => m.querySelector('lucide-icon'))).toBe(true);
  });

  it('fills one pip per attended event, up to the requirement', () => {
    expect(component.pips(1, 2)).toEqual([true, false]);
    expect(component.pips(9, 6)).toEqual([true, true, true, true, true, true]);
  });

  it('shows the empty state when nobody is pending', () => {
    mockPersonService.getShirtCandidates.mockReturnValue(of([]));
    component.load();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hi ha cap persona pendent de camisa.');
  });

  describe('award modal', () => {
    it('defaults the date to today', () => {
      component.openAward(eligible);
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      expect(component.awardDate()).toBe(
        `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
      );
    });

    it('does not warn for an eligible person', () => {
      component.openAward(eligible);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="shirt-award-warning"]')).toBeNull();
    });

    it('warns with what is missing for a person who is not eligible yet', () => {
      component.openAward(inProgress);
      fixture.detectChanges();

      expect(text('[data-testid="shirt-award-warning"]')).toContain('li falten 1 actuació i 2 assajos');
    });

    it('awards with the chosen date, notifies and reloads', () => {
      component.openAward(inProgress);
      component.awardDate.set('2026-10-10');
      mockPersonService.getShirtCandidates.mockClear();

      component.confirmAward();

      expect(mockPersonService.update).toHaveBeenCalledWith('c1', { shirtDate: '2026-10-10' });
      expect(mockToast.success).toHaveBeenCalledWith("S'ha lliurat la camisa a Encara.");
      expect(mockPersonService.getShirtCandidates).toHaveBeenCalled();
      expect(component.awarding()).toBeNull();
    });
  });

  describe('missingText', () => {
    it('uses singular and plural forms and skips a met requirement', () => {
      expect(component.missingText(makeCandidate({ performancesAttended: 1, rehearsalsAttended: 5 }))).toBe(
        'li falten 1 actuació i 1 assaig',
      );
      expect(component.missingText(makeCandidate({ performancesAttended: 0, rehearsalsAttended: 6 }))).toBe(
        'li falten 2 actuacions',
      );
      expect(component.missingText(makeCandidate({ performancesAttended: 2, rehearsalsAttended: 5 }))).toBe(
        'li falta 1 assaig',
      );
    });
  });
});
