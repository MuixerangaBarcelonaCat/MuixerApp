import { TroncHeightThresholds } from '../utils/tronc-height.util';

/** Checked-in (`ASSISTIT`) events a person needs to be given the camisa, counted over all seasons. */
export interface ShirtRequirements {
  performances: number;
  rehearsals: number;
}

/** The colla's own parameters (`GET /colla-settings`), edited by an ADMIN at `/config/colla`. */
export interface CollaSettings {
  collaName: string;
  shirtRequirements: ShirtRequirements;
  /** Shoulder height (cm) that relative heights are shown against (+/- this value). */
  shoulderHeightBaselineCm: number;
  troncHeightThresholds: TroncHeightThresholds;
  /** Days after an event's date past which its assignments and attendance are locked. 0 disables the lock. */
  assignmentLockDays: number;
  /** Whether the nightly sweep marks today's performances `ANIRE` → `ASSISTIT`. */
  autoCheckInPerformances: boolean;
  /** Tag given to every new person; `null` gives none. */
  defaultTagId: string | null;
  /** Age from which a person with a known birth date stops being xicalla. */
  majorityAge: number;
}

/** What the login screen may read before anyone signs in (`GET /colla-settings/public`). */
export interface PublicCollaSettings {
  collaName: string;
}

export type UpdateCollaSettings = Partial<CollaSettings>;
