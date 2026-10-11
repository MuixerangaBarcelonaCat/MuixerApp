import { ThemeMode, formatHex, hexToOklch } from './color';
import { SEMANTIC } from './fixed-colors';
import { NodeTones } from './node-types';

/**
 * The tones the segment workspace's display modes recolor nodes with (Display Modes preview, round
 * 2). Each mode has a light and a dark set, like the node type palette: a light wash with a strong
 * pencil on paper, a dark wash with a light pencil on the dark canvas.
 */

type Level = { l: number; c: number };

function tones(h: number, wash: Level, pencil: Level): NodeTones {
  return { wash: formatHex({ ...wash, h }), pencil: formatHex({ ...pencil, h }) };
}

export type GenderGroup = 'female' | 'male' | 'other';

// Violet · gold · neutral. Red–green dichromats only see a blue↔yellow axis, so no third hue could
// sit apart from both others: «Altre o sense dades» is a neutral, which also suits missing data.
/** Node tones per gender group, light mode. */
export const GENDER_TONES: Record<GenderGroup, NodeTones> = {
  female: tones(290, { l: 0.88, c: 0.09 }, { l: 0.49, c: 0.12 }),
  male: tones(88, { l: 0.9, c: 0.1 }, { l: 0.55, c: 0.12 }),
  other: tones(80, { l: 0.86, c: 0.012 }, { l: 0.5, c: 0.02 }),
};

/** Node tones per gender group, dark mode. */
export const GENDER_TONES_DARK: Record<GenderGroup, NodeTones> = {
  female: tones(290, { l: 0.37, c: 0.07 }, { l: 0.78, c: 0.1 }),
  male: tones(88, { l: 0.37, c: 0.06 }, { l: 0.78, c: 0.1 }),
  other: tones(80, { l: 0.4, c: 0.01 }, { l: 0.75, c: 0.015 }),
};

export type AttendanceTone = 'success' | 'warning' | 'error';

/**
 * Attendance in the app's semantic hues, at even lightness steps so the three read equally loud.
 * `strong` marks someone who also comes to the next actuació: darker on paper, lighter on the dark
 * canvas — the shade that stands out more from the page in each mode.
 */
export interface AttendanceShades {
  base: NodeTones;
  strong: NodeTones;
}

const ATTENDANCE_KEYS: AttendanceTone[] = ['success', 'warning', 'error'];

function attendanceTones(levels: Record<keyof AttendanceShades, { wash: Level; pencil: Level }>): Record<AttendanceTone, AttendanceShades> {
  return Object.fromEntries(
    ATTENDANCE_KEYS.map((key) => {
      const h = hexToOklch(SEMANTIC[key]).h;
      return [key, { base: tones(h, levels.base.wash, levels.base.pencil), strong: tones(h, levels.strong.wash, levels.strong.pencil) }];
    }),
  ) as Record<AttendanceTone, AttendanceShades>;
}

/** Attendance node tones, light mode. */
export const ATTENDANCE_TONES = attendanceTones({
  base: { wash: { l: 0.9, c: 0.06 }, pencil: { l: 0.5, c: 0.12 } },
  strong: { wash: { l: 0.72, c: 0.11 }, pencil: { l: 0.42, c: 0.12 } },
});

/** Attendance node tones, dark mode. */
export const ATTENDANCE_TONES_DARK = attendanceTones({
  base: { wash: { l: 0.36, c: 0.05 }, pencil: { l: 0.72, c: 0.1 } },
  strong: { wash: { l: 0.56, c: 0.1 }, pencil: { l: 0.82, c: 0.08 } },
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The height ramp at `t` (0 = shortest, 1 = tallest): gold → teal → blue, hue and lightness moving
 * together so close heights still differ. Light mode darkens with height; dark mode keeps the hue
 * order and flips the lightness, so the gold end stays clean on the dark canvas.
 */
export function heightRampTones(t: number, mode: ThemeMode = 'light'): NodeTones {
  const x = Math.min(1, Math.max(0, t));
  const h = lerp(95, 260, x);
  if (mode === 'light') {
    const l = lerp(0.93, 0.6, x);
    return { wash: formatHex({ l, c: lerp(0.1, 0.11, x), h }), pencil: formatHex({ l: Math.max(0.36, l - 0.38), c: 0.12, h }) };
  }
  const l = lerp(0.6, 0.34, x);
  return { wash: formatHex({ l, c: lerp(0.09, 0.08, x), h }), pencil: formatHex({ l: Math.min(0.9, l + 0.3), c: 0.09, h }) };
}
