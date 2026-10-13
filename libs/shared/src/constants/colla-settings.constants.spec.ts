import { DEFAULT_COLLA_SETTINGS } from './colla-settings.constants';

describe('DEFAULT_COLLA_SETTINGS', () => {
  it('keeps the values that were hard-coded before the colla had its own settings', () => {
    expect(DEFAULT_COLLA_SETTINGS).toEqual({
      collaName: 'Muixeranga de Barcelona',
      shirtRequirements: { performances: 2, rehearsals: 6 },
      shoulderHeightBaselineCm: 140,
      troncHeightThresholds: {
        floor: { warning: 5, error: 10 },
        support: { warning: 3, error: 5 },
      },
      assignmentLockDays: 2,
      autoCheckInPerformances: true,
      defaultTagId: null,
      majorityAge: 16,
    });
  });
});
