import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DEFAULT_COLLA_SETTINGS } from '@muixer/shared';
import { UpdateCollaSettingsDto } from './update-colla-settings.dto';

const errorsFor = async (body: Record<string, unknown>) =>
  validate(plainToInstance(UpdateCollaSettingsDto, body), { whitelist: true, forbidNonWhitelisted: true });

const invalidPaths = async (body: Record<string, unknown>): Promise<string[]> => {
  const paths: string[] = [];
  const walk = (errors: Awaited<ReturnType<typeof validate>>, prefix: string) => {
    for (const e of errors) {
      const path = prefix ? `${prefix}.${e.property}` : e.property;
      if (e.constraints) paths.push(path);
      walk(e.children ?? [], path);
    }
  };
  walk(await errorsFor(body), '');
  return paths;
};

describe('UpdateCollaSettingsDto', () => {
  it('accepts every setting at once', async () => {
    expect(await errorsFor({ ...DEFAULT_COLLA_SETTINGS, defaultTagId: '3f2b6a1e-8c4d-4e5f-9a0b-1c2d3e4f5a6b' })).toHaveLength(0);
  });

  it('accepts an empty patch', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('accepts no default tag', async () => {
    expect(await errorsFor({ defaultTagId: null })).toHaveLength(0);
  });

  it('accepts a lock of 0 days (no lock)', async () => {
    expect(await errorsFor({ assignmentLockDays: 0 })).toHaveLength(0);
  });

  it.each([
    [{ collaName: '   ' }, 'collaName'],
    [{ collaName: 'x'.repeat(101) }, 'collaName'],
    [{ shoulderHeightBaselineCm: 49 }, 'shoulderHeightBaselineCm'],
    [{ shoulderHeightBaselineCm: 140.5 }, 'shoulderHeightBaselineCm'],
    [{ assignmentLockDays: -1 }, 'assignmentLockDays'],
    [{ majorityAge: 0 }, 'majorityAge'],
    [{ autoCheckInPerformances: 'yes' }, 'autoCheckInPerformances'],
    [{ defaultTagId: 'not-a-uuid' }, 'defaultTagId'],
    [{ shirtRequirements: { performances: -1, rehearsals: 6 } }, 'shirtRequirements.performances'],
    [{ shirtRequirements: { performances: 2 } }, 'shirtRequirements.rehearsals'],
    [
      { troncHeightThresholds: { floor: { warning: 0, error: 10 }, support: { warning: 3, error: 5 } } },
      'troncHeightThresholds.floor.warning',
    ],
    [{ troncHeightThresholds: { floor: { warning: 5, error: 10 } } }, 'troncHeightThresholds.support'],
  ])('rejects %j', async (body, path) => {
    expect(await invalidPaths(body)).toEqual([path]);
  });

  it('rejects unknown fields', async () => {
    expect(await invalidPaths({ colour: '#fff' })).toEqual(['colour']);
  });

  it('trims the colla name', () => {
    expect(plainToInstance(UpdateCollaSettingsDto, { collaName: '  Muixeranga  ' }).collaName).toBe('Muixeranga');
  });
});
