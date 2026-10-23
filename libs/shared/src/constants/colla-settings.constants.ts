import { CollaSettings } from '../interfaces/colla-settings.interface';

/**
 * The values used until the stored settings are read, and when they can't be (tests, an API
 * error, offline). The `colla_settings` migration seeds the same values.
 */
export const DEFAULT_COLLA_SETTINGS: CollaSettings = {
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
  rehearsalDefaults: { title: 'Assaig general', startTime: '18:45', location: 'Lleialtat Santsenca', locationUrl: null },
};
