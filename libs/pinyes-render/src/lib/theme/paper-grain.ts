import { CREASE, PAPER, ThemeMode } from '@muixer/ui';

/** Tile side of the noise, in CSS pixels. */
const TILE = 160;

/**
 * The canvas paper's grain, as a CSS background image: SVG fractal noise, as on the preview (Pinya
 * Canvas Options), flecked faintly with the darkest crease tone on paper, or with paper white on
 * the dark canvas. Drawn in CSS under the Konva stage, never in Konva.
 */
export function paperGrain(mode: ThemeMode): string {
  const [hex, alpha] = mode === 'dark' ? [PAPER.white, 0.035] : [CREASE.dark, 0.06];
  const [r, g, b] = [1, 3, 5].map((i) => +(parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">` +
    `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${alpha} 0"/></filter>` +
    `<rect width="${TILE}" height="${TILE}" filter="url(#n)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
