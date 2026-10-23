import { Gender } from '@muixer/shared';
import {
  ATTENDANCE_TONES,
  ATTENDANCE_TONES_DARK,
  GENDER_TONES,
  GENDER_TONES_DARK,
  NODE_TYPE_NEUTRAL,
  NODE_TYPE_NEUTRAL_DARK,
  NODE_TYPE_PALETTE,
  NODE_TYPE_PALETTE_DARK,
  heightRampTones,
} from '@muixer/ui';
import {
  DisplayContext,
  DisplayFacts,
  attendanceTone,
  displayCategory,
  displayModeKey,
  displayModeOverrides,
  displayTones,
  heightDomain,
  personDisplayFacts,
  positionKey,
} from './display-mode';

const facts = (overrides: Partial<DisplayFacts> = {}): DisplayFacts => ({
  shoulderHeight: 150,
  gender: Gender.FEMALE,
  attendance: 'ANIRE',
  nextActuacio: false,
  ...overrides,
});

const ctx = (overrides: Partial<DisplayContext> = {}): DisplayContext => ({
  mode: 'position',
  phase: 'before',
  heightDomain: { heights: [140, 150, 160] },
  themeMode: 'light',
  ...overrides,
});

describe('heightDomain', () => {
  it('holds the known heights, shortest first', () => {
    expect(heightDomain([152, 143, null, 172, 161, 152])).toEqual({ heights: [143, 152, 152, 161, 172] });
  });

  it('ignores unknown heights: null and 0 (0 is how an unset height is stored by some imports)', () => {
    expect(heightDomain([0, 150, null])).toEqual({ heights: [150] });
  });

  it('is null when no one has a known height', () => {
    expect(heightDomain([])).toBeNull();
    expect(heightDomain([null, 0])).toBeNull();
  });
});

describe('attendanceTone', () => {
  it.each(['before', 'day'] as const)('until the start (%s): arrived and coming are success, pending is warning, not coming is error', (phase) => {
    expect(attendanceTone('ASSISTIT', phase)).toBe('success');
    expect(attendanceTone('ANIRE', phase)).toBe('success');
    expect(attendanceTone('PENDENT', phase)).toBe('warning');
    expect(attendanceTone('NO_VAIG', phase)).toBe('error');
  });

  it.each(['started', 'after'] as const)('from the start (%s): coming but not here yet turns warning', (phase) => {
    expect(attendanceTone('ASSISTIT', phase)).toBe('success');
    expect(attendanceTone('ANIRE', phase)).toBe('warning');
    expect(attendanceTone('PENDENT', phase)).toBe('warning');
    expect(attendanceTone('NO_VAIG', phase)).toBe('error');
  });

  it('treats an unknown status as pending (no row is PENDENT)', () => {
    expect(attendanceTone(null, 'before')).toBe('warning');
  });
});

describe('displayCategory', () => {
  it('has no category in Posició: the type palette applies', () => {
    expect(displayCategory(facts(), ctx())).toBeNull();
  });

  it('places a height by its rank in the tab, 0 (shortest) to 1 (tallest), so a crowded middle spreads over the whole ramp', () => {
    const c = ctx({ mode: 'height', heightDomain: { heights: [140, 148, 149, 150, 170] } });
    const t = (cm: number) => displayCategory(facts({ shoulderHeight: cm }), c);
    expect([140, 148, 149, 150, 170].map(t)).toEqual([0, 0.25, 0.5, 0.75, 1].map((x) => ({ kind: 'height', t: x })));
  });

  it('gives people of the same height the same place, the middle of the ranks they share', () => {
    const c = ctx({ mode: 'height', heightDomain: { heights: [140, 150, 150, 160] } });
    expect(displayCategory(facts({ shoulderHeight: 150 }), c)).toEqual({ kind: 'height', t: 0.5 });
  });

  it('puts everyone in the middle of the ramp when the tab has a single height', () => {
    expect(displayCategory(facts({ shoulderHeight: 150 }), ctx({ mode: 'height', heightDomain: { heights: [150] } }))).toEqual({ kind: 'height', t: 0.5 });
    expect(displayCategory(facts({ shoulderHeight: 150 }), ctx({ mode: 'height', heightDomain: { heights: [150, 150] } }))).toEqual({ kind: 'height', t: 0.5 });
  });

  it('places a height the tab lacks between its neighbours, and one beyond the tab at its end', () => {
    const c = ctx({ mode: 'height' });
    expect(displayCategory(facts({ shoulderHeight: 145 }), c)).toEqual({ kind: 'height', t: 0.25 });
    expect(displayCategory(facts({ shoulderHeight: 130 }), c)).toEqual({ kind: 'height', t: 0 });
    expect(displayCategory(facts({ shoulderHeight: 175 }), c)).toEqual({ kind: 'height', t: 1 });
  });

  it('marks an unknown height', () => {
    expect(displayCategory(facts({ shoulderHeight: null }), ctx({ mode: 'height' }))).toEqual({ kind: 'unknown-height' });
    expect(displayCategory(facts({ shoulderHeight: 0 }), ctx({ mode: 'height' }))).toEqual({ kind: 'unknown-height' });
  });

  it('groups OTHER and unknown gender together', () => {
    const c = ctx({ mode: 'gender' });
    expect(displayCategory(facts({ gender: Gender.FEMALE }), c)).toEqual({ kind: 'gender', group: 'female' });
    expect(displayCategory(facts({ gender: Gender.MALE }), c)).toEqual({ kind: 'gender', group: 'male' });
    expect(displayCategory(facts({ gender: Gender.OTHER }), c)).toEqual({ kind: 'gender', group: 'other' });
    expect(displayCategory(facts({ gender: null }), c)).toEqual({ kind: 'gender', group: 'other' });
  });

  it('pairs the attendance tone with whether the person comes to the next actuació', () => {
    const c = ctx({ mode: 'attendance' });
    expect(displayCategory(facts({ attendance: 'ANIRE', nextActuacio: true }), c)).toEqual({ kind: 'attendance', tone: 'success', strong: true });
    expect(displayCategory(facts({ attendance: 'NO_VAIG' }), c)).toEqual({ kind: 'attendance', tone: 'error', strong: false });
  });
});

describe('displayTones', () => {
  it('is null in Posició', () => {
    expect(displayTones(facts(), ctx())).toBeNull();
  });

  it('reads the height ramp, in the theme mode', () => {
    expect(displayTones(facts({ shoulderHeight: 160 }), ctx({ mode: 'height' }))).toEqual(heightRampTones(1, 'light'));
    expect(displayTones(facts({ shoulderHeight: 140 }), ctx({ mode: 'height', themeMode: 'dark' }))).toEqual(heightRampTones(0, 'dark'));
  });

  it('draws an unknown height in the neutral tones', () => {
    expect(displayTones(facts({ shoulderHeight: null }), ctx({ mode: 'height' }))).toEqual(NODE_TYPE_NEUTRAL);
    expect(displayTones(facts({ shoulderHeight: null }), ctx({ mode: 'height', themeMode: 'dark' }))).toEqual(NODE_TYPE_NEUTRAL_DARK);
  });

  it('reads the gender tones', () => {
    expect(displayTones(facts({ gender: Gender.MALE }), ctx({ mode: 'gender' }))).toEqual(GENDER_TONES.male);
    expect(displayTones(facts({ gender: null }), ctx({ mode: 'gender', themeMode: 'dark' }))).toEqual(GENDER_TONES_DARK.other);
  });

  it('reads the strong attendance shade for someone coming to the next actuació', () => {
    const c = ctx({ mode: 'attendance' });
    expect(displayTones(facts({ attendance: 'PENDENT', nextActuacio: true }), c)).toEqual(ATTENDANCE_TONES.warning.strong);
    expect(displayTones(facts({ attendance: 'PENDENT' }), c)).toEqual(ATTENDANCE_TONES.warning.base);
    expect(displayTones(facts({ attendance: 'ASSISTIT' }), { ...c, themeMode: 'dark' })).toEqual(ATTENDANCE_TONES_DARK.success.base);
  });
});

describe('displayModeOverrides', () => {
  it('changes nothing in Posició, assigned or empty', () => {
    expect(displayModeOverrides(facts(), ctx())).toEqual({});
    expect(displayModeOverrides(null, ctx())).toEqual({});
  });

  it('draws an empty node neutral in every other mode, so a type color never reads as a mode color', () => {
    for (const mode of ['height', 'attendance', 'gender'] as const) {
      expect(displayModeOverrides(null, ctx({ mode }))).toEqual({ palette: 'neutral' });
    }
  });

  it('recolors a person in Gènere and Alçada and keeps the attendance fill and the star', () => {
    expect(displayModeOverrides(facts({ gender: Gender.MALE }), ctx({ mode: 'gender' }))).toEqual({ tones: GENDER_TONES.male });
    expect(displayModeOverrides(facts({ shoulderHeight: 140 }), ctx({ mode: 'height' }))).toEqual({ tones: heightRampTones(0, 'light') });
  });

  it('in Assistència draws every person solid and strikes only who won\'t come (the star stays, next to the darker shade)', () => {
    const c = ctx({ mode: 'attendance', phase: 'started' });
    expect(displayModeOverrides(facts({ attendance: 'NO_VAIG' }), c)).toEqual({
      tones: ATTENDANCE_TONES.error.base,
      fillPolicy: 'solid',
      attendance: 'absent',
    });
    // PENDENT after the start is "absent" for the attendance fill, but it isn't struck here: it's a warning.
    expect(displayModeOverrides(facts({ attendance: 'PENDENT', nextActuacio: true }), c)).toEqual({
      tones: ATTENDANCE_TONES.warning.strong,
      fillPolicy: 'solid',
      attendance: 'confirmed',
    });
  });
});

describe('personDisplayFacts', () => {
  const sources = {
    attendance: new Map([['p1', 'ASSISTIT']]),
    nextPerformance: new Map<string, string | null>([['p1', 'ANIRE'], ['p2', 'NO_VAIG']]),
    details: new Map([['p1', { gender: Gender.MALE }]]),
  };

  it('reads the height off the assignment and the rest off the roster maps', () => {
    expect(personDisplayFacts({ id: 'p1', shoulderHeight: 158 }, sources)).toEqual({
      shoulderHeight: 158,
      gender: Gender.MALE,
      attendance: 'ASSISTIT',
      nextActuacio: true,
    });
  });

  it('knows nothing about a person missing from the roster: unknown gender, no status, not coming', () => {
    expect(personDisplayFacts({ id: 'p2', shoulderHeight: null }, sources)).toEqual({
      shoulderHeight: null,
      gender: null,
      attendance: null,
      nextActuacio: false,
    });
  });
});

const plain = (tones: { wash: string; pencil: string }) => ({ tones, star: false });
const starred = (tones: { wash: string; pencil: string }) => ({ tones, star: true });

describe('displayModeKey', () => {
  it('is empty in Posició (the position key is built from the nodes, see positionKey)', () => {
    expect(displayModeKey([facts()], ctx())).toEqual({ gradient: null, rows: [], note: null });
  });

  it('lists only the gender groups that appear, with their counts', () => {
    const people = [facts({ gender: Gender.MALE }), facts({ gender: null }), facts({ gender: Gender.MALE })];
    expect(displayModeKey(people, ctx({ mode: 'gender' }))).toEqual({
      gradient: null,
      note: null,
      rows: [
        { id: 'male', label: 'Home', swatches: [plain(GENDER_TONES.male)], count: 2 },
        { id: 'other', label: 'Altre o sense dades', swatches: [plain(GENDER_TONES.other)], count: 1 },
      ],
    });
  });

  it('shows the height gradient with the cm at each quarter of the ranks, and «Sense alçada» only when someone has no height', () => {
    const c = ctx({ mode: 'height', heightDomain: { heights: [143, 150, 152, 160, 172] } });
    expect(displayModeKey([facts({ shoulderHeight: 143 }), facts({ shoulderHeight: 172 })], c)).toEqual({ gradient: { quarters: [143, 150, 152, 160, 172] }, rows: [], note: null });
    expect(displayModeKey([facts({ shoulderHeight: 143 }), facts({ shoulderHeight: null })], c).rows).toEqual([
      { id: 'unknown-height', label: 'Sense alçada', swatches: [plain(NODE_TYPE_NEUTRAL)], count: 1 },
    ]);
  });

  it('reads a quarter between two heights in whole cm, and a single height as one mark', () => {
    const at = (heights: number[]) => displayModeKey([facts()], ctx({ mode: 'height', heightDomain: { heights } })).gradient;
    expect(at([140, 150])).toEqual({ quarters: [140, 143, 145, 148, 150] });
    expect(at([150, 150])).toEqual({ quarters: [150] });
  });

  it('groups attendance by color, naming only the statuses present, in the phase\'s words', () => {
    const people = [
      facts({ attendance: 'ASSISTIT' }),
      facts({ attendance: 'ANIRE' }),
      facts({ attendance: 'PENDENT' }),
      facts({ attendance: 'NO_VAIG' }),
    ];
    expect(displayModeKey(people, ctx({ mode: 'attendance', phase: 'day' })).rows).toEqual([
      { id: 'success', label: 'Ha arribat o ve', swatches: [plain(ATTENDANCE_TONES.success.base)], count: 2 },
      { id: 'warning', label: 'Pendent', swatches: [plain(ATTENDANCE_TONES.warning.base)], count: 1 },
      { id: 'error', label: 'No vindrà', swatches: [plain(ATTENDANCE_TONES.error.base)], count: 1 },
    ]);
    expect(displayModeKey(people, ctx({ mode: 'attendance', phase: 'started' })).rows.map((r) => r.label)).toEqual([
      'Ha arribat',
      'No ha arribat o pendent',
      'No vindrà',
    ]);
  });

  it('draws the darker shade with the star, as the canvas does, and notes what it means only when someone comes', () => {
    const key = displayModeKey(
      [facts({ attendance: 'ANIRE', nextActuacio: true }), facts({ attendance: 'ANIRE' })],
      ctx({ mode: 'attendance' }),
    );
    expect(key.rows).toEqual([
      { id: 'success', label: 'Ve', swatches: [plain(ATTENDANCE_TONES.success.base), starred(ATTENDANCE_TONES.success.strong)], count: 2 },
    ]);
    expect(key.note).toEqual({ label: 'Ve a la propera actuació', count: 1 });
    expect(displayModeKey([facts({ attendance: 'ANIRE' })], ctx({ mode: 'attendance' })).note).toBeNull();
  });

  it('once anyone comes to the next actuació, gives every row both shades, so the squares line up in two columns', () => {
    const rows = displayModeKey(
      [facts({ attendance: 'ANIRE', nextActuacio: true }), facts({ attendance: 'NO_VAIG' }), facts({ attendance: 'PENDENT', nextActuacio: true })],
      ctx({ mode: 'attendance' }),
    ).rows;
    expect(rows.map((r) => r.swatches)).toEqual([
      [plain(ATTENDANCE_TONES.success.base), starred(ATTENDANCE_TONES.success.strong)],
      [plain(ATTENDANCE_TONES.warning.base), starred(ATTENDANCE_TONES.warning.strong)],
      [plain(ATTENDANCE_TONES.error.base), starred(ATTENDANCE_TONES.error.strong)],
    ]);
  });

  it('draws the key swatches in the theme mode', () => {
    const rows = displayModeKey([facts({ gender: Gender.FEMALE })], ctx({ mode: 'gender', themeMode: 'dark' })).rows;
    expect(rows[0].swatches).toEqual([plain(GENDER_TONES_DARK.female)]);
  });
});

describe('positionKey', () => {
  it('lists the pinya types drawn, in the presets\' order, named as people say them, with no count', () => {
    expect(positionKey(['vents', 'agulla', 'vents', 'comodin'], 'light')).toEqual({
      gradient: null,
      note: null,
      rows: [
        { id: 'agulla', label: 'Agulla', swatches: [plain(NODE_TYPE_PALETTE['agulla'])], count: null },
        { id: 'vents', label: 'Vent', swatches: [plain(NODE_TYPE_PALETTE['vents'])], count: null },
        { id: 'comodin', label: 'Comodí', swatches: [plain(NODE_TYPE_PALETTE['comodin'])], count: null },
      ],
    });
  });

  it('leaves out what has no type color (bases, decorations, untyped nodes)', () => {
    expect(positionKey(['base', 'rectangle', null], 'light').rows).toEqual([]);
  });

  it('uses the dark palette on the dark canvas', () => {
    expect(positionKey(['tap'], 'dark').rows[0].swatches).toEqual([plain(NODE_TYPE_PALETTE_DARK['tap'])]);
  });
});
