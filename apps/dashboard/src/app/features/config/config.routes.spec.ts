import { describe, expect, it } from 'vitest';
import { configRoutes } from './config.routes';
import { CollaSettingsComponent } from './components/colla-settings/colla-settings.component';

describe('configRoutes', () => {
  it('serves the colla settings at /config/colla, behind a role guard (ADMIN only)', () => {
    const route = configRoutes.find((r) => r.path === 'colla');

    expect(route?.component).toBe(CollaSettingsComponent);
    expect(route?.data?.['title']).toBe('Configuració de la colla');
    expect(route?.canActivate).toHaveLength(1);
  });
});
