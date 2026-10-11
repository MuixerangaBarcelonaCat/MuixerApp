import { nodeOutline } from './outline';
import { hashSeed, mulberry32, roughOpts, sketchDisc, sketchLoop, sketchShape, sketchWobble } from './sketch';

const PENCIL = '#4a6b8a';
const WASH = '#d6e4f0';
const rect = nodeOutline('RECTANGLE', 80, 40);
const style = { stroke: PENCIL, strokeWidth: 1.3, dash: null };
const moves = (d: string) => d.match(/M/g)?.length ?? 0;
/** Bounding box of every point in a path's data (end and control points alike). */
function bounds(d: string) {
  const n = (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe('mulberry32', () => {
  it('draws the same sequence from the same seed, in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashSeed', () => {
  it('is stable for the same text and spreads different texts apart', () => {
    expect(hashSeed('Alta clàssica|4,4,2,1,1')).toBe(hashSeed('Alta clàssica|4,4,2,1,1'));
    expect(hashSeed('Pinet de 5')).not.toBe(hashSeed('Campana'));
  });
});

describe('roughOpts', () => {
  it('never hands rough.js a zero seed, which it would take as "random every time"', () => {
    expect(roughOpts(0, 20).seed).toBeGreaterThan(0);
    expect(roughOpts(2 ** 32 - 1, 20).seed).toBeGreaterThan(0);
  });

  it('scales the wobble down with the size of the shape, so a small mark doesn\'t dissolve into noise', () => {
    expect(roughOpts(1, 2).maxRandomnessOffset).toBe(0.5);
    expect(roughOpts(1, 5).maxRandomnessOffset).toBeCloseTo(0.9);
    expect(roughOpts(1, 40).maxRandomnessOffset).toBe(2);
  });

  it('draws one pen stroke, a little steadier than the preview (roughness 0.6, not 0.9), unless told otherwise', () => {
    const opts = roughOpts(1, 20);
    expect(opts).toMatchObject({ roughness: 0.6, bowing: 0.6, disableMultiStroke: true, disableMultiStrokeFill: true });
    expect(roughOpts(1, 20, { roughness: 1.3 }).roughness).toBe(1.3);
  });
});

describe('sketchWobble', () => {
  it('is 5% of the smaller side, so a node wobbles in proportion to its size', () => {
    expect(sketchWobble(20)).toBeCloseTo(1);
    expect(sketchWobble(30)).toBeCloseTo(1.5);
  });

  it('never drops below 0.4, so a tiny mark still looks drawn by hand', () => {
    expect(sketchWobble(4)).toBe(0.4);
  });

  it('never goes past 2, the wobble of a standard 40-tall node, however big the shape', () => {
    expect(sketchWobble(40)).toBe(2);
    expect(sketchWobble(120)).toBe(2);
  });
});

describe('sketchShape', () => {
  /** How far the outline reaches past the node's edge, worst over a few seeds. */
  const reach = (w: number, h: number) => {
    let worst = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const [outline] = sketchShape(nodeOutline('RECTANGLE', w, h), { ...style, fill: { style: 'none' } }, seed);
      const box = bounds(outline.d);
      worst = Math.max(worst, box.maxX - w / 2, -w / 2 - box.minX, box.maxY - h / 2, -h / 2 - box.minY);
    }
    return worst;
  };

  it('wobbles a small node less than a standard one, in proportion', () => {
    expect(reach(80, 20)).toBeLessThan(reach(80, 40) * 0.65);
  });

  it('wobbles a big node no more than a standard one', () => {
    expect(reach(240, 120)).toBeLessThan(reach(80, 40) * 1.25);
  });

  it('lays a solid wash first, then the pen outline over it', () => {
    const paths = sketchShape(rect, { ...style, fill: { style: 'solid', color: WASH } }, 7);
    const fill = paths.filter((p) => p.role === 'fill');
    const outline = paths.filter((p) => p.role === 'outline');
    expect(fill.length).toBeGreaterThan(0);
    expect(fill.every((p) => p.fill === WASH && p.stroke === null)).toBe(true);
    expect(outline).toHaveLength(1);
    expect(outline[0]).toMatchObject({ stroke: PENCIL, strokeWidth: 1.3, fill: null, dash: null });
    expect(paths[paths.length - 1].role).toBe('outline');
  });

  it('hatches a pending node with pen lines in the hatch colour, one unit thick', () => {
    const paths = sketchShape(rect, { ...style, fill: { style: 'hatch', color: PENCIL } }, 7);
    const fill = paths.filter((p) => p.role === 'fill');
    expect(fill.length).toBeGreaterThan(0);
    expect(fill.every((p) => p.stroke === PENCIL && p.strokeWidth === 1 && p.fill === null)).toBe(true);
    // Lines 6 apart across a 40-tall node: several strokes, not one.
    expect(fill.reduce((n, p) => n + moves(p.d), 0)).toBeGreaterThan(5);
  });

  it('draws only the outline when the node has no fill', () => {
    const paths = sketchShape(rect, { ...style, fill: { style: 'none' } }, 7);
    expect(paths.map((p) => p.role)).toEqual(['outline']);
  });

  it('dashes the outline, never the fill', () => {
    const paths = sketchShape(rect, { ...style, dash: [5, 4], fill: { style: 'solid', color: WASH } }, 7);
    expect(paths.find((p) => p.role === 'outline')?.dash).toEqual([5, 4]);
    expect(paths.filter((p) => p.role === 'fill').every((p) => p.dash === null)).toBe(true);
  });

  it('wobbles: the outline is pen curves, not the straight rectangle', () => {
    const [outline] = sketchShape(rect, { ...style, fill: { style: 'none' } }, 7);
    expect(outline.d).toMatch(/C/);
  });

  it('draws the same wobble for the same seed, a different one for another seed', () => {
    const at = (seed: number) => sketchShape(rect, { ...style, fill: { style: 'none' } }, seed)[0].d;
    expect(at(7)).toBe(at(7));
    expect(at(7)).not.toBe(at(8));
  });

  it('draws ellipses and polygons too', () => {
    const none = { ...style, fill: { style: 'none' as const } };
    expect(sketchShape(nodeOutline('ELLIPSE', 80, 40), none, 7)[0].d).toMatch(/C/);
    expect(sketchShape(nodeOutline('ARROW', 80, 40), none, 7)[0].d).toMatch(/C/);
  });
});

describe('sketchLoop', () => {
  it('rings the node twice with a looser pen, in the given colour', () => {
    const [loop] = sketchLoop(51, 32, '#c74007', 2, 7);
    expect(loop).toMatchObject({ role: 'outline', stroke: '#c74007', strokeWidth: 2, fill: null });
    expect(moves(loop.d)).toBe(2);
  });
});

describe('sketchDisc', () => {
  it('draws a filled, sketched circle centred on (x, y)', () => {
    const paths = sketchDisc({ x: 30, y: -20, radius: 10, fill: '#fafaf8', stroke: '#b8b0a0', strokeWidth: 1 }, 7);
    expect(paths.find((p) => p.role === 'fill')?.fill).toBe('#fafaf8');
    expect(paths.find((p) => p.role === 'outline')).toMatchObject({ stroke: '#b8b0a0', strokeWidth: 1 });
    const box = bounds(paths.find((p) => p.role === 'outline')?.d ?? '');
    // Within the wobble of the centre.
    expect(Math.abs((box.minX + box.maxX) / 2 - 30)).toBeLessThan(1.5);
    expect(Math.abs((box.minY + box.maxY) / 2 + 20)).toBeLessThan(1.5);
    expect(box.maxX - box.minX).toBeGreaterThan(18);
  });
});
