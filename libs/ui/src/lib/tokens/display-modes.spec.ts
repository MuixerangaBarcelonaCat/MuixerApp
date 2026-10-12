import { hexToOklch } from './color';
import { SEMANTIC } from './fixed-colors';
import {
  ATTENDANCE_TONES,
  ATTENDANCE_TONES_DARK,
  GENDER_TONES,
  GENDER_TONES_DARK,
  heightRampTones,
} from './display-modes';

// The values the user picked on the Display Modes preview (round 2): violet · gold · neutral for
// gender, even lightness steps on the semantic hues for attendance, and the gold → teal → blue
// continuous height ramp. Pinned so a change to the levels shows up as a diff against what was approved.
describe('GENDER_TONES', () => {
  it('has the approved violet · gold · neutral tones, light and dark', () => {
    expect(GENDER_TONES).toEqual({
      female: { wash: '#d6d1ff', pencil: '#61529f' },
      male: { wash: '#fadb90', pencil: '#8d6d00' },
      other: { wash: '#d5d0c8', pencil: '#696257' },
    });
    expect(GENDER_TONES_DARK).toEqual({
      female: { wash: '#3f3962', pencil: '#b6adf3' },
      male: { wash: '#4d3e16', pencil: '#d2b46a' },
      other: { wash: '#4b4742', pencil: '#b3ada4' },
    });
  });
});

describe('ATTENDANCE_TONES', () => {
  it('has the approved even-step tones, light and dark', () => {
    expect(ATTENDANCE_TONES).toEqual({
      success: { base: { wash: '#b7ecd8', pencil: '#00755b' }, strong: { wash: '#50bb9b', pencil: '#005b46' } },
      warning: { base: { wash: '#eeddb1', pencil: '#7a5f00' }, strong: { wash: '#c0a14c', pencil: '#604a00' } },
      error: { base: { wash: '#ffd3c5', pencil: '#9b462c' }, strong: { wash: '#e08c71', pencil: '#812f13' } },
    });
    expect(ATTENDANCE_TONES_DARK).toEqual({
      success: { base: { wash: '#1e4639', pencil: '#5cb99c' }, strong: { wash: '#21876c', pencil: '#8ed5bd' } },
      warning: { base: { wash: '#473c1c', pencil: '#bda257' }, strong: { wash: '#8c7122', pencil: '#d9c288' } },
      error: { base: { wash: '#54342a', pencil: '#db8e76' }, strong: { wash: '#a65e48', pencil: '#f3b39f' } },
    });
  });

  it('takes each hue from its semantic token, so the canvas speaks the same colors as the badges', () => {
    for (const key of ['success', 'warning', 'error'] as const) {
      const hue = hexToOklch(SEMANTIC[key]).h;
      expect(hexToOklch(ATTENDANCE_TONES[key].base.wash).h).toBeCloseTo(hue, -1);
      expect(hexToOklch(ATTENDANCE_TONES[key].strong.wash).h).toBeCloseTo(hue, -1);
    }
  });

  it('draws the strong shade (comes to the next actuació) darker in light mode and lighter in dark mode', () => {
    for (const key of ['success', 'warning', 'error'] as const) {
      expect(hexToOklch(ATTENDANCE_TONES[key].strong.wash).l).toBeLessThan(hexToOklch(ATTENDANCE_TONES[key].base.wash).l);
      expect(hexToOklch(ATTENDANCE_TONES_DARK[key].strong.wash).l).toBeGreaterThan(hexToOklch(ATTENDANCE_TONES_DARK[key].base.wash).l);
    }
  });
});

describe('heightRampTones', () => {
  it('has the approved ends and midpoint, light and dark', () => {
    expect([0, 0.5, 1].map((t) => heightRampTones(t, 'light'))).toEqual([
      { wash: '#fde89a', pencil: '#867000' },
      { wash: '#5dc9b2', pencil: '#005043' },
      { wash: '#5880c2', pencil: '#11397b' },
    ]);
    expect([0, 0.5, 1].map((t) => heightRampTones(t, 'dark'))).toEqual([
      { wash: '#91803c', pencil: '#f0de99' },
      { wash: '#076a5a', pencil: '#70c7b4' },
      { wash: '#1e3761', pencil: '#6c8dc3' },
    ]);
  });

  it('defaults to light mode', () => {
    expect(heightRampTones(0.3)).toEqual(heightRampTones(0.3, 'light'));
  });

  it('clamps t outside [0, 1] to the ends', () => {
    expect(heightRampTones(-1, 'light')).toEqual(heightRampTones(0, 'light'));
    expect(heightRampTones(2, 'dark')).toEqual(heightRampTones(1, 'dark'));
  });

  it('gets steadily darker from short to tall in light mode', () => {
    const ls = [0, 0.25, 0.5, 0.75, 1].map((t) => hexToOklch(heightRampTones(t, 'light').wash).l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeLessThan(ls[i - 1]);
  });
});
