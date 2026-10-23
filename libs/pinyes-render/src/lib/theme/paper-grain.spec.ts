import { CREASE, PAPER } from '@muixer/ui';
import { paperGrain } from './paper-grain';

/** The SVG inside the grain's data URI. */
const svgOf = (grain: string) => decodeURIComponent(/^url\("data:image\/svg\+xml,(.+)"\)$/.exec(grain)?.[1] ?? '');
/** The RGB tint and alpha the noise is painted with, from its colour matrix. */
function tintOf(grain: string): { rgb: number[]; alpha: number } {
  const values = /<feColorMatrix values="([^"]+)"/.exec(svgOf(grain))?.[1].split(' ').map(Number) ?? [];
  return { rgb: [values[4], values[9], values[14]], alpha: values[18] };
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

describe('paperGrain', () => {
  it('is a CSS background image of SVG noise', () => {
    const svg = svgOf(paperGrain('light'));
    expect(svg).toContain('<feTurbulence');
    expect(svg).toContain('stitchTiles="stitch"');
  });

  it('flecks the light paper with its darkest crease tone, faintly', () => {
    const { rgb: tint, alpha } = tintOf(paperGrain('light'));
    rgb(CREASE.dark).forEach((c, i) => expect(tint[i]).toBeCloseTo(c, 2));
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(0.08);
  });

  it('flecks the dark canvas with paper white instead, so the grain still shows', () => {
    const { rgb: tint, alpha } = tintOf(paperGrain('dark'));
    rgb(PAPER.white).forEach((c, i) => expect(tint[i]).toBeCloseTo(c, 2));
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(0.08);
  });
});
