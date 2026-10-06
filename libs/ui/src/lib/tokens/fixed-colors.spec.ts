import { converter, formatHex, wcagContrast } from 'culori';
import { PAPER, SEMANTIC } from './fixed-colors';

const toRgb = converter('rgb');
const toOklab = converter('oklab');

// Machado, Oliveira & Fernandes (2009) dichromacy matrices, severity 1.0, applied in linear sRGB.
const CVD_MATRICES = {
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
} as const;

type Dichromacy = keyof typeof CVD_MATRICES;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (c: number) => Math.min(1, Math.max(0, c));

function simulate(hex: string, type: Dichromacy): string {
  const rgb = toRgb(hex);
  if (!rgb) throw new Error(`Invalid hex color: ${hex}`);
  const linear = [rgb.r, rgb.g, rgb.b].map(toLinear);
  const [r, g, b] = CVD_MATRICES[type].map((row) =>
    toGamma(clamp01(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2])),
  );
  return formatHex({ mode: 'rgb', r, g, b });
}

// Distance on OKLab's a/b plane only (×100). Lightness is left out on purpose: a small
// lightness gap is invisible on the tiny marks where these colors matter most (calendar dots),
// so only hue/chroma separation counts as "distinguishable".
function hueSeparation(a: string, b: string, type: Dichromacy): number {
  const labA = toOklab(simulate(a, type));
  const labB = toOklab(simulate(b, type));
  return Math.hypot(labA.a - labB.a, labA.b - labB.b) * 100;
}

describe('SEMANTIC error/success', () => {
  it('stay distinguishable by hue for deuteranopes', () => {
    expect(hueSeparation(SEMANTIC.error, SEMANTIC.success, 'deuteranopia')).toBeGreaterThan(10);
  });

  it('stay distinguishable by hue for protanopes', () => {
    expect(hueSeparation(SEMANTIC.error, SEMANTIC.success, 'protanopia')).toBeGreaterThan(7);
  });

  it.each([
    ['error', SEMANTIC.error],
    ['success', SEMANTIC.success],
  ])('%s meets WCAG AA text contrast on every paper surface', (_role, hex) => {
    for (const surface of [PAPER.white, PAPER.cream]) {
      expect(wcagContrast(hex, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
