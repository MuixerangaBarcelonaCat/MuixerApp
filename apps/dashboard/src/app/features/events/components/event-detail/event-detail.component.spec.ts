import { vi } from 'vitest';
import { EventDetailComponent } from './event-detail.component';
import { AttendanceStatus } from '@muixer/shared';
import { AttendanceSummary } from '../../models/event.model';

/**
 * Pure-unit tests for EventDetailComponent helper methods.
 * No Angular TestBed needed — the methods under test are stateless logic.
 */
describe('EventDetailComponent — getSummaryForDisplay', () => {
  let component: Pick<
    EventDetailComponent,
    'getSummaryForDisplay' | 'isPast' | 'getStatusLabel' | 'getStatusBadgeClass' | 'formatDate' | 'formatDateTime'
  >;

  const pastSummary: AttendanceSummary = {
    confirmed: 3,     // ANIRE count (no-shows)
    declined: 15,
    pending: 8,
    attended: 55,
    lateCancel: 2,
    children: 5,
    childrenAttended: 3,
    total: 81,
  };

  const futureSummary: AttendanceSummary = {
    confirmed: 30,
    declined: 10,
    pending: 20,
    attended: 0,
    lateCancel: 0,
    children: 4,
    childrenAttended: 0,
    total: 60,
  };

  beforeEach(() => {
    component = Object.create(EventDetailComponent.prototype) as EventDetailComponent;
  });

  describe('past event', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => true;
    });

    it('includes Assistit row with attended value', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'Assistit');
      expect(row).toBeDefined();
      expect(row!.value).toBe(55);
    });

    it('includes No presentat row with confirmed (ANIRE) count', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'No presentat');
      expect(row).toBeDefined();
      expect(row!.value).toBe(3); // pastSummary.confirmed = 3
    });

    it('shows lateCancel row when lateCancel > 0', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'Baixes tardanes');
      expect(row).toBeDefined();
      expect(row!.value).toBe(2);
    });

    it('hides lateCancel row when lateCancel === 0', () => {
      const summary = { ...pastSummary, lateCancel: 0 };
      const rows = component.getSummaryForDisplay(summary);
      expect(rows.find((r) => r.label === 'Baixes tardanes')).toBeUndefined();
    });

    it('shows Total row', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'Total');
      expect(row).toBeDefined();
      expect(row!.value).toBe(81);
    });

    it('includes Adults row with correct value (attended - children)', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'Adults');
      expect(row).toBeDefined();
      expect(row!.value).toBe(50);
    });
  });

  describe('future event', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => false;
    });

    it('includes Aniré row with confirmed value', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      const row = rows.find((r) => r.label === 'Aniré');
      expect(row).toBeDefined();
      expect(row!.value).toBe(30);
    });

    it('does not include No presentat row', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      expect(rows.find((r) => r.label === 'No presentat')).toBeUndefined();
    });

    it('does not include Baixes tardanes row', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      expect(rows.find((r) => r.label === 'Baixes tardanes')).toBeUndefined();
    });

    it('includes Adults row with correct value (confirmed - children)', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      const row = rows.find((r) => r.label === 'Adults');
      expect(row).toBeDefined();
      expect(row!.value).toBe(26);
    });
  });

  describe('icon fields use Lucide names (not emojis)', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => false;
    });

    it('all rows have icon as a Lucide icon name string', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      const validIcons = ['UserCheck', 'UserMinus', 'Users', 'UserX', 'AlertCircle', 'Clock', 'Baby', 'UsersRound'];
      for (const row of rows) {
        expect(validIcons).toContain(row.icon);
      }
    });

    it('all rows have an iconClass string', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      for (const row of rows) {
        expect(row.iconClass).toBeDefined();
        expect(typeof row.iconClass).toBe('string');
      }
    });
  });
});

describe('EventDetailComponent — getStatusLabel', () => {
  let component: Pick<EventDetailComponent, 'getStatusLabel' | 'isPast'>;

  beforeEach(() => {
    component = Object.create(EventDetailComponent.prototype) as EventDetailComponent;
  });

  describe('past event labels', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => true;
    });

    it.each([
      [AttendanceStatus.PENDENT, 'Sense resposta'],
      [AttendanceStatus.ANIRE, 'No presentat'],
      [AttendanceStatus.NO_VAIG, 'No va anar'],
      [AttendanceStatus.ASSISTIT, 'Assistit'],
    ] as const)('%s → "%s"', (status, expected) => {
      expect(component.getStatusLabel(status)).toBe(expected);
    });
  });

  describe('future event labels', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => false;
    });

    it('NO_VAIG → "No vaig" for future event', () => {
      expect(component.getStatusLabel(AttendanceStatus.NO_VAIG)).toBe('No vaig');
    });
  });
});

describe('EventDetailComponent — getStatusBadgeClass', () => {
  let component: Pick<EventDetailComponent, 'getStatusBadgeClass' | 'isPast'>;

  beforeEach(() => {
    component = Object.create(EventDetailComponent.prototype) as EventDetailComponent;
  });

  describe('future event (isPast=false)', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => false;
    });

    it.each([
      [AttendanceStatus.PENDENT, 'badge-ghost'],
      [AttendanceStatus.ANIRE, 'badge-success'],
      [AttendanceStatus.NO_VAIG, 'badge-error'],
      [AttendanceStatus.ASSISTIT, 'badge-success'],
    ] as const)('%s → "%s"', (status, expected) => {
      expect(component.getStatusBadgeClass(status)).toBe(expected);
    });
  });

  describe('past event (isPast=true)', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => true;
    });

    it('ANIRE → badge-warning for past event', () => {
      expect(component.getStatusBadgeClass(AttendanceStatus.ANIRE)).toBe('badge-warning');
    });

    it('ASSISTIT → badge-success for past event', () => {
      expect(component.getStatusBadgeClass(AttendanceStatus.ASSISTIT)).toBe('badge-success');
    });

    it('NO_VAIG → badge-error for past event', () => {
      expect(component.getStatusBadgeClass(AttendanceStatus.NO_VAIG)).toBe('badge-error');
    });
  });
});

describe('EventDetailComponent — navigateToPerson', () => {
  it('navigates to /persons/:id', () => {
    const comp = Object.create(EventDetailComponent.prototype) as EventDetailComponent;
    const navigateMock = vi.fn();
    (comp as unknown as { router: unknown }).router = { navigate: navigateMock };
    comp.navigateToPerson('person-123');
    expect(navigateMock).toHaveBeenCalledWith(['/persons', 'person-123']);
  });
});
