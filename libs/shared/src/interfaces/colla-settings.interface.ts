import { TroncHeightThresholds } from '../utils/tronc-height.util';

/** Checked-in (`ASSISTIT`) events a person needs to be given the camisa, counted over all seasons. */
export interface ShirtRequirements {
  performances: number;
  rehearsals: number;
}

/** What a new rehearsal starts with in the event form. Performances start empty. */
export interface RehearsalDefaults {
  /** May be empty: no title is filled in. */
  title: string;
  /** `HH:mm`; `null`: no start time is filled in. */
  startTime: string | null;
  /** May be empty: no place is filled in. */
  location: string;
  /** `null`: no place link is filled in. */
  locationUrl: string | null;
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
  rehearsalDefaults: RehearsalDefaults;
}

/** What the login screen may read before anyone signs in (`GET /colla-settings/public`). */
export interface PublicCollaSettings {
  collaName: string;
}

export type UpdateCollaSettings = Partial<CollaSettings>;
