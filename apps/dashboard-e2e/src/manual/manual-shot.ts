import { Page } from '@playwright/test';

export type ManualApp = 'dashboard' | 'pwa' | 'pwa-member';

/** One screenshot of the user manual (`docs/manual/img/`). */
export interface ManualShot {
  /** File name inside docs/manual/img/, e.g. '03-persones-llista.png'. */
  file: string;
  app: ManualApp;
  /** App route; may use TARGETS. */
  path: string;
  /** Locator that must be visible before the shot. */
  ready?: string;
  /** Clicks or actions after navigating (open a tab or a modal). */
  prepare?: (page: Page) => Promise<void>;
  /** Locator outlined in red for the shot. */
  highlight?: string;
  /** Elements blurred in the shot: personal data (names, surnames, email, phone). Aliases are not. */
  blur?: string[];
  /** Shoot only this element instead of the viewport. */
  clip?: string;
  settle?: number;
}
