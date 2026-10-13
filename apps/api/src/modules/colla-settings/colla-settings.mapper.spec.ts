import { DEFAULT_COLLA_SETTINGS } from '@muixer/shared';
import { CollaSettingsEntity } from './colla-settings.entity';
import { toCollaSettings, toCollaSettingsColumns } from './colla-settings.mapper';

const row = (): CollaSettingsEntity =>
  ({
    id: 'settings-id',
    collaName: 'Muixeranga de Prova',
    shirtRequiredPerformances: 3,
    shirtRequiredRehearsals: 8,
    shoulderHeightBaselineCm: 135,
    troncFloorWarningCm: 4,
    troncFloorErrorCm: 9,
    troncSupportWarningCm: 2,
    troncSupportErrorCm: 6,
    assignmentLockDays: 0,
    autoCheckInPerformances: false,
    defaultTagId: 'tag-id',
    majorityAge: 18,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as CollaSettingsEntity;

describe('colla settings mapper', () => {
  it('nests the flat columns', () => {
    expect(toCollaSettings(row())).toEqual({
      collaName: 'Muixeranga de Prova',
      shirtRequirements: { performances: 3, rehearsals: 8 },
      shoulderHeightBaselineCm: 135,
      troncHeightThresholds: { floor: { warning: 4, error: 9 }, support: { warning: 2, error: 6 } },
      assignmentLockDays: 0,
      autoCheckInPerformances: false,
      defaultTagId: 'tag-id',
      majorityAge: 18,
    });
  });

  it('flattens settings back into the same columns', () => {
    const columns: Partial<CollaSettingsEntity> = row();
    delete columns.id;
    delete columns.createdAt;
    delete columns.updatedAt;

    expect(toCollaSettingsColumns(toCollaSettings(row()))).toEqual(columns);
  });

  it('flattens the defaults', () => {
    expect(toCollaSettingsColumns(DEFAULT_COLLA_SETTINGS)).toMatchObject({
      shirtRequiredPerformances: 2,
      troncSupportErrorCm: 5,
      defaultTagId: null,
    });
  });
});
