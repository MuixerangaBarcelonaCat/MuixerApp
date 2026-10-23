import { CollaSettings } from '@muixer/shared';
import { CollaSettingsEntity } from './colla-settings.entity';

export type CollaSettingsColumns = Omit<CollaSettingsEntity, 'id' | 'createdAt' | 'updatedAt' | 'defaultTag'>;

export function toCollaSettings(row: CollaSettingsEntity): CollaSettings {
  return {
    collaName: row.collaName,
    shirtRequirements: { performances: row.shirtRequiredPerformances, rehearsals: row.shirtRequiredRehearsals },
    shoulderHeightBaselineCm: row.shoulderHeightBaselineCm,
    troncHeightThresholds: {
      floor: { warning: row.troncFloorWarningCm, error: row.troncFloorErrorCm },
      support: { warning: row.troncSupportWarningCm, error: row.troncSupportErrorCm },
    },
    assignmentLockDays: row.assignmentLockDays,
    autoCheckInPerformances: row.autoCheckInPerformances,
    defaultTagId: row.defaultTagId,
    majorityAge: row.majorityAge,
    rehearsalDefaults: {
      title: row.rehearsalDefaultTitle,
      startTime: row.rehearsalDefaultStartTime,
      location: row.rehearsalDefaultLocation,
      locationUrl: row.rehearsalDefaultLocationUrl,
    },
  };
}

export function toCollaSettingsColumns(settings: CollaSettings): CollaSettingsColumns {
  const { floor, support } = settings.troncHeightThresholds;
  return {
    collaName: settings.collaName,
    shirtRequiredPerformances: settings.shirtRequirements.performances,
    shirtRequiredRehearsals: settings.shirtRequirements.rehearsals,
    shoulderHeightBaselineCm: settings.shoulderHeightBaselineCm,
    troncFloorWarningCm: floor.warning,
    troncFloorErrorCm: floor.error,
    troncSupportWarningCm: support.warning,
    troncSupportErrorCm: support.error,
    assignmentLockDays: settings.assignmentLockDays,
    autoCheckInPerformances: settings.autoCheckInPerformances,
    defaultTagId: settings.defaultTagId,
    majorityAge: settings.majorityAge,
    rehearsalDefaultTitle: settings.rehearsalDefaults.title,
    rehearsalDefaultStartTime: settings.rehearsalDefaults.startTime,
    rehearsalDefaultLocation: settings.rehearsalDefaults.location,
    rehearsalDefaultLocationUrl: settings.rehearsalDefaults.locationUrl,
  };
}
