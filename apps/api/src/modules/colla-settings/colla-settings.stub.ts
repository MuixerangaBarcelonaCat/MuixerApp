import { CollaSettings, DEFAULT_COLLA_SETTINGS, PublicCollaSettings } from '@muixer/shared';
import { CollaSettingsService } from './colla-settings.service';

/**
 * For specs: stands in for `CollaSettingsService` (`{ provide: CollaSettingsService, useValue: stub }`)
 * and serves fixed settings, the defaults unless overridden.
 */
export class CollaSettingsStub implements Pick<CollaSettingsService, 'get' | 'getPublic'> {
  private settings: CollaSettings;

  constructor(overrides: Partial<CollaSettings> = {}) {
    this.settings = { ...DEFAULT_COLLA_SETTINGS, ...overrides };
  }

  set(overrides: Partial<CollaSettings>): void {
    this.settings = { ...this.settings, ...overrides };
  }

  async get(): Promise<CollaSettings> {
    return this.settings;
  }

  async getPublic(): Promise<PublicCollaSettings> {
    return { collaName: this.settings.collaName };
  }
}
