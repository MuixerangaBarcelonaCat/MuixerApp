import { describe, it, expect } from 'vitest';
import rough from 'roughjs';
import type { RoughSVG } from 'roughjs/bin/svg';
import {
  buildPersonGlyphMarkup,
  buildSilhouetteMarkup,
  buildPinyaMarkup,
  buildGroundLineMarkup,
} from './template-preview-drawing.render';
import { layoutTroncSilhouette, hashSeed } from '../../utils/tronc-silhouette-layout.util';

function makeRc(): RoughSVG {
  return rough.svg(document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement);
}

describe('buildPersonGlyphMarkup', () => {
  it('draws a non-empty sketched person (head, torso, legs, arms) as SVG path markup', () => {
    const markup = buildPersonGlyphMarkup(makeRc(), 20, 40, 6, 1234, 'oklch(var(--p))');
    expect(markup).toContain('<path');
    // head + torso + 2 legs + 2 arms = at least 5 strokes
    expect(markup.match(/<path/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('is deterministic for the same position/radius/seed', () => {
    const a = buildPersonGlyphMarkup(makeRc(), 20, 40, 6, 1234, 'oklch(var(--p))');
    const b = buildPersonGlyphMarkup(makeRc(), 20, 40, 6, 1234, 'oklch(var(--p))');
    expect(a).toBe(b);
  });

  it('differs for a different seed', () => {
    const a = buildPersonGlyphMarkup(makeRc(), 20, 40, 6, 1234, 'oklch(var(--p))');
    const b = buildPersonGlyphMarkup(makeRc(), 20, 40, 6, 5678, 'oklch(var(--p))');
    expect(a).not.toBe(b);
  });

  it('draws differently when reaching toward a side than with default outward arms', () => {
    const outward = buildPersonGlyphMarkup(makeRc(), 20, 40, 6, 1234, 'oklch(var(--p))');
    const reachingRight = buildPersonGlyphMarkup(makeRc(), 20, 40, 6, 1234, 'oklch(var(--p))', 1);
    const reachingLeft = buildPersonGlyphMarkup(makeRc(), 20, 40, 6, 1234, 'oklch(var(--p))', -1);
    expect(reachingRight).not.toBe(outward);
    expect(reachingLeft).not.toBe(outward);
    expect(reachingRight).not.toBe(reachingLeft);
  });
});

describe('buildPinyaMarkup', () => {
  it('returns nothing for an empty layout', () => {
    const layout = layoutTroncSilhouette([], hashSeed('empty'));
    const result = buildPinyaMarkup(makeRc(), layout, 1, 'oklch(var(--s))');
    expect(result.markup).toBe('');
    expect(result.minX).toBe(0);
    expect(result.maxX).toBe(layout.width);
  });

  it('draws people flanking both sides of the base, extending the bounds outward', () => {
    const layout = layoutTroncSilhouette([4, 2], hashSeed('Campana'));
    const result = buildPinyaMarkup(makeRc(), layout, hashSeed('Campana'), 'oklch(var(--s))');
    expect(result.markup).toContain('<path');
    expect(result.markup).toContain('oklch(var(--s))');
    expect(result.minX).toBeLessThan(0);
    expect(result.maxX).toBeGreaterThan(layout.width);
  });

  it('is deterministic for the same layout and seed', () => {
    const layout = layoutTroncSilhouette([4, 2], hashSeed('Campana'));
    const a = buildPinyaMarkup(makeRc(), layout, hashSeed('Campana'), 'oklch(var(--s))');
    const b = buildPinyaMarkup(makeRc(), layout, hashSeed('Campana'), 'oklch(var(--s))');
    expect(a).toEqual(b);
  });
});

describe('buildGroundLineMarkup', () => {
  it('draws a non-empty rough line', () => {
    const markup = buildGroundLineMarkup(makeRc(), -20, 100, 60, 42, 'oklch(var(--p))');
    expect(markup).toContain('<path');
    expect(markup).toContain('oklch(var(--p))');
  });

  it('is deterministic for the same span and seed', () => {
    const a = buildGroundLineMarkup(makeRc(), -20, 100, 60, 42, 'oklch(var(--p))');
    const b = buildGroundLineMarkup(makeRc(), -20, 100, 60, 42, 'oklch(var(--p))');
    expect(a).toBe(b);
  });
});

describe('buildSilhouetteMarkup', () => {
  it('returns empty markup for an empty layout', () => {
    const layout = layoutTroncSilhouette([], hashSeed('empty'));
    expect(buildSilhouetteMarkup(makeRc(), layout, 1, 'oklch(var(--p))')).toBe('');
  });

  it('draws one person glyph per profile entry', () => {
    const layout = layoutTroncSilhouette([2, 1], hashSeed('Torreta'));
    const markup = buildSilhouetteMarkup(makeRc(), layout, hashSeed('Torreta'), 'oklch(var(--p))');
    // 3 people * >=5 strokes each
    expect(markup.match(/<path/g)?.length).toBeGreaterThanOrEqual(15);
  });
});
