import { FONT_FAMILY } from '@muixer/ui';
import { FigureZone } from '@muixer/shared';
import { buildCanvasTheme } from '../theme/canvas-theme';
import { NodeAppearanceInput, resolveNodeAppearance } from './appearance';
import { DrawPrimitive, NODE_SKETCH_INSET, NODE_TEXT_SCALE, fitNodeName, nodeDrawPlan, scaledNodeDrawPlan } from './draw-plan';
import { nodeOutline } from './outline';
import { sketchShape } from './sketch';

const theme = buildCanvasTheme();
const measure = (text: string, fontSize: number, _fontFamily?: string) => text.length * fontSize * 0.6;
const W = 80;
const H = 40;

const marta: NodeAppearanceInput = {
  zone: FigureZone.PINYA,
  positionType: 'vents',
  color: null,
  label: 'Vent 1',
  mode: 'workspace',
  person: { name: 'Marta', height: '+4', nextActuacio: true, observation: { emoji: '🤕' } },
};

const SEED = 7;
const plan = (input: Partial<NodeAppearanceInput>, shape = 'RECTANGLE', seed = SEED) =>
  nodeDrawPlan(resolveNodeAppearance({ ...marta, ...input }, theme), { width: W, height: H, shape, seed }, theme, measure);

/** Bounding box of every point in a path's data (end and control points alike). */
function bounds(d: string) {
  const n = (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function only<K extends DrawPrimitive['kind']>(items: DrawPrimitive[], kind: K, role?: string) {
  return items.filter((p) => p.kind === kind && (!role || ('role' in p && p.role === role))) as Extract<
    DrawPrimitive,
    { kind: K }
  >[];
}

describe('nodeDrawPlan', () => {
  it('starts with the node shape, in the appearance fill and outline', () => {
    const [first] = plan({ attendance: 'pending' });
    expect(first).toEqual({
      kind: 'shape',
      shape: 'RECTANGLE',
      width: W,
      height: H,
      fill: { style: 'hatch', color: expect.any(String) },
      stroke: expect.any(String),
      strokeWidth: 1.3,
      dash: null,
      sketch: expect.any(Array),
    });
  });

  it('sketches the shape with the pen: its fill and outline, seeded by the node', () => {
    const [shape] = only(plan({ attendance: 'pending', dropTarget: 'swap' }), 'shape');
    expect(shape.sketch).toEqual(
      sketchShape(
        nodeOutline('RECTANGLE', W - 2 * NODE_SKETCH_INSET, H - 2 * NODE_SKETCH_INSET),
        { fill: shape.fill, stroke: shape.stroke, strokeWidth: shape.strokeWidth, dash: shape.dash },
        SEED,
      ),
    );
  });

  it('draws the pen outline a few units inside the node, so the wobble of two neighbours never meets', () => {
    const [shape] = only(plan({ attendance: 'confirmed' }), 'shape');
    // The node keeps its footprint (clicks, drops, text); only the drawing is inset.
    expect([shape.width, shape.height]).toEqual([W, H]);
    const outline = shape.sketch.find((p) => p.role === 'outline');
    const box = bounds(outline?.d ?? '');
    expect(box.maxX).toBeLessThan(W / 2);
    expect(box.minX).toBeGreaterThan(-W / 2);
    expect(box.maxY).toBeLessThan(H / 2);
    expect(box.minY).toBeGreaterThan(-H / 2);
    expect(shape.sketch).toEqual(
      sketchShape(
        nodeOutline('RECTANGLE', W - 2 * NODE_SKETCH_INSET, H - 2 * NODE_SKETCH_INSET),
        { fill: shape.fill, stroke: shape.stroke, strokeWidth: shape.strokeWidth, dash: shape.dash },
        SEED,
      ),
    );
  });

  it('insets the outline less on a node smaller than the standard 40-unit height', () => {
    const small = nodeDrawPlan(resolveNodeAppearance(marta, theme), { width: 40, height: 20, shape: 'RECTANGLE', seed: SEED }, theme, measure);
    const [shape] = only(small, 'shape');
    expect(shape.sketch).toEqual(
      sketchShape(
        nodeOutline('RECTANGLE', 40 - NODE_SKETCH_INSET, 20 - NODE_SKETCH_INSET),
        { fill: shape.fill, stroke: shape.stroke, strokeWidth: shape.strokeWidth, dash: shape.dash },
        SEED,
      ),
    );
  });

  it('draws the same strokes for the same node every time, other strokes for another node', () => {
    const sketches = (seed: number) => plan({ conflict: true }, 'RECTANGLE', seed).flatMap((p) => ('sketch' in p && p.sketch ? p.sketch : []));
    expect(sketches(SEED)).toEqual(sketches(SEED));
    expect(sketches(SEED)[0].d).not.toBe(sketches(SEED + 1)[0].d);
  });

  it('thins the outline and the loop on nodes smaller than the standard 40-unit height, never thickens them', () => {
    const small = nodeDrawPlan(resolveNodeAppearance({ ...marta, conflict: true }, theme), { width: 40, height: 20, shape: 'RECTANGLE' }, theme, measure);
    expect(only(small, 'shape')[0].strokeWidth).toBeCloseTo(1.3 / 2);
    expect(only(small, 'loop')[0].width).toBeCloseTo(0.7);
    const large = nodeDrawPlan(resolveNodeAppearance(marta, theme), { width: 160, height: 80, shape: 'RECTANGLE' }, theme, measure);
    expect(only(large, 'shape')[0].strokeWidth).toBeCloseTo(1.3);
  });

  it('hatches a pending node at the same density whatever its size: lines apart and thick in proportion to its height', () => {
    const hatching = (height: number) => {
      const appearance = resolveNodeAppearance({ ...marta, attendance: 'pending' }, theme);
      const [shape] = only(nodeDrawPlan(appearance, { width: height * 2, height, shape: 'RECTANGLE', seed: SEED }, theme, measure), 'shape');
      const lines = shape.sketch.filter((p) => p.role === 'fill');
      return { count: lines.reduce((n, p) => n + (p.d.match(/M/g)?.length ?? 0), 0), weight: lines[0].strokeWidth };
    };
    const standard = hatching(H);
    // The 40-unit node keeps the hatching as previewed: one unit thick.
    expect(standard.weight).toBe(1);
    expect(hatching(H / 2)).toEqual({ count: standard.count, weight: 0.5 });
    // The inset stops shrinking past the standard height, so a bigger node may gain a line at most.
    const big = hatching(H * 2);
    expect(big.weight).toBe(2);
    expect(Math.abs(big.count - standard.count)).toBeLessThanOrEqual(1);
  });

  it('centres the name in Atkinson 700 in the projection, fitted to the node', () => {
    const [name] = only(plan({ mode: 'projection' }), 'text', 'name');
    expect(name).toMatchObject({
      text: 'Marta',
      x: 0,
      y: 0,
      fontSize: H * NODE_TEXT_SCALE.nameMax,
      fontFamily: FONT_FAMILY.legible.join(', '),
      fontStyle: 'bold',
      align: 'center',
    });
  });

  it('writes a name in Quicksand 700 at one size while staffing, whatever its length', () => {
    const [short] = only(plan({}), 'text', 'name');
    const [long] = only(plan({ person: { name: 'Maria José' } }), 'text', 'name');
    expect(short).toMatchObject({ fontSize: H * 0.28, fontFamily: FONT_FAMILY.sans.join(', '), fontStyle: 'bold' });
    expect(long.fontSize).toBe(short.fontSize);
  });

  it('cuts a name too wide for the node with an ellipsis, at that same size', () => {
    const [name] = only(plan({ person: { name: 'Bartomeu Ferrandis' } }), 'text', 'name');
    expect(name.fontSize).toBeCloseTo(H * 0.28);
    expect(name.text.endsWith('…')).toBe(true);
    expect(measure(name.text, name.fontSize)).toBeLessThanOrEqual(W - 2 * NODE_TEXT_SCALE.namePaddingX);
  });

  it('measures each name in the typeface it is drawn with', () => {
    const spy = jest.fn(measure);
    nodeDrawPlan(resolveNodeAppearance(marta, theme), { width: W, height: H, shape: 'RECTANGLE' }, theme, spy);
    nodeDrawPlan(resolveNodeAppearance({ ...marta, mode: 'projection' }, theme), { width: W, height: H, shape: 'RECTANGLE' }, theme, spy);
    const families = new Set(spy.mock.calls.map((call) => call[2]));
    expect(families).toEqual(new Set([FONT_FAMILY.sans.join(', '), FONT_FAMILY.legible.join(', ')]));
  });

  it('raises the conflict loop, the observation sticker and the move badge above the neighbouring nodes, and nothing else', () => {
    const items = plan({ moveSource: true, conflict: true, person: { name: 'Marta', height: '+4', nextActuacio: true, observation: { emoji: '🤕' } } });
    const raised = items.filter((p) => p.raised);
    expect(raised.map((p) => p.kind)).toEqual(['loop', 'disc', 'text', 'disc', 'icon']);
    expect(only(raised, 'text')[0].text).toBe('🤕');
    expect(items.filter((p) => !p.raised).every((p) => p.kind !== 'disc')).toBe(true);
  });

  describe('decoration text', () => {
    const decoration = (mode: NodeAppearanceInput['mode'], size: { width: number; height: number }, label = 'Bandera') =>
      only(
        nodeDrawPlan(
          resolveNodeAppearance({ ...marta, zone: FigureZone.DECORATION, positionType: 'circle', person: null, label, mode }, theme),
          { ...size, shape: 'RECTANGLE' },
          theme,
          measure,
        ),
        'text',
        'caption',
      )[0];

    it('is Quicksand at the size of a name on a standard node while staffing, however big the decoration', () => {
      const small = decoration('workspace', { width: 160, height: 40 });
      const big = decoration('workspace', { width: 400, height: 200 });
      expect(small).toMatchObject({ fontFamily: FONT_FAMILY.sans.join(', '), fontSize: 40 * NODE_TEXT_SCALE.nameUniform, wrap: true });
      expect(big.fontSize).toBe(small.fontSize);
    });

    it('shrinks with a decoration smaller than a standard node', () => {
      expect(decoration('template', { width: 80, height: 20 }).fontSize).toBeCloseTo(20 * NODE_TEXT_SCALE.nameUniform);
    });

    it('is Atkinson in the projection, fitted to the decoration: as large as it fits, up to 0.45 of its height', () => {
      const big = decoration('projection', { width: 400, height: 200 });
      expect(big).toMatchObject({ fontFamily: FONT_FAMILY.legible.join(', '), fontSize: 200 * 0.45, wrap: true });
    });

    it('wraps a long text onto more lines before it shrinks it in the projection', () => {
      const text = 'Colla Muixeranga de la Vila';
      const fitted = decoration('projection', { width: 200, height: 120 }, text);
      // One line at 0.45 × height would be far too wide; wrapped, it still keeps a large size.
      expect(fitted.fontSize).toBeLessThan(120 * 0.45);
      expect(fitted.fontSize).toBeGreaterThan(120 * 0.15);
      expect(measure('Muixeranga', fitted.fontSize)).toBeLessThanOrEqual(200 - 8);
    });
  });

  it('rings a pending name with a paper halo a third of its size wide', () => {
    const [name] = only(plan({ attendance: 'pending' }), 'text', 'name');
    expect(name.halo).toEqual({ color: theme.paper, width: name.fontSize * 0.32 });
  });

  it('writes an empty position label in Quicksand caps, wrapping inside the node', () => {
    const [label] = only(plan({ person: null }), 'text', 'label');
    expect(label).toMatchObject({
      text: 'VENT 1',
      fontSize: H * NODE_TEXT_SCALE.label,
      fontFamily: FONT_FAMILY.sans.join(', '),
      fontStyle: 'bold',
      wrap: true,
    });
  });

  it('keeps a template label as it was typed', () => {
    const [label] = only(plan({ person: null, mode: 'template' }), 'text', 'label');
    expect(label.text).toBe('Vent 1');
  });

  it('strikes an absent name through, as wide as the name', () => {
    const [strike] = only(plan({ attendance: 'absent' }), 'strike');
    const [name] = only(plan({ attendance: 'absent' }), 'text', 'name');
    const textWidth = measure(name.text, name.fontSize);
    expect(strike.x1).toBeCloseTo(-textWidth / 2 - 2);
    expect(strike.x2).toBeCloseTo(textWidth / 2 + 2);
    expect(strike.color).toBe(theme.inkMuted);
  });

  it('puts the height top-left in muted Quicksand', () => {
    const [height] = only(plan({}), 'text', 'height');
    expect(height).toMatchObject({
      text: '+4',
      x: -W / 2 + 4,
      fontSize: H * 0.27,
      align: 'left',
      fill: theme.inkMuted,
    });
  });

  it('keeps the height inside the top edge', () => {
    const [height] = only(plan({}), 'text', 'height');
    expect(height.y - height.fontSize / 2).toBeGreaterThanOrEqual(-H / 2 + 1);
  });

  it('puts the star bottom-left and the conflict icon bottom-right', () => {
    const icons = only(plan({ conflict: true }), 'icon');
    expect(icons.find((i) => i.icon === 'star')).toMatchObject({ x: -W / 2 + H * 0.17, y: H / 2 - H * 0.17, size: H * NODE_TEXT_SCALE.star, filled: true });
    expect(icons.find((i) => i.icon === 'conflict')).toMatchObject({
      x: W / 2 - H * 0.22,
      y: H / 2 - H * 0.24,
      size: H * NODE_TEXT_SCALE.conflictIcon,
      color: theme.danger,
    });
  });

  it('draws a thin red loop close around a node in conflict, outside the node', () => {
    const [loop] = only(plan({ conflict: true }), 'loop');
    expect(loop).toEqual({
      kind: 'loop',
      radiusX: (W + 14) / 2,
      radiusY: (H + 16) / 2,
      color: theme.danger,
      width: 1.4,
      raised: true,
      sketch: expect.any(Array),
    });
    expect(loop.sketch.length).toBeGreaterThan(0);
    expect(loop.sketch.every((p) => p.stroke === theme.danger && p.strokeWidth === 1.4)).toBe(true);
  });

  it('sets the observation on a paper sticker straddling the top edge at the right', () => {
    const r = H * NODE_TEXT_SCALE.stickerRadius;
    const [sticker] = only(plan({}), 'disc');
    expect(sticker).toEqual({
      kind: 'disc',
      // On the drawn edge, inset from the node's.
      x: W / 2 - NODE_SKETCH_INSET - r * 0.95,
      y: -H / 2 + NODE_SKETCH_INSET + r * 0.12,
      radius: r,
      fill: theme.sticker,
      stroke: theme.stickerEdge,
      strokeWidth: 1,
      raised: true,
      sketch: expect.any(Array),
    });
    // A sketched paper sticker; the move badge stays a clean ink disc.
    expect(sticker.sketch?.find((p) => p.role === 'fill')?.fill).toBe(theme.sticker);
    expect(sticker.sketch?.find((p) => p.role === 'outline')?.stroke).toBe(theme.stickerEdge);
    const [emoji] = only(plan({}), 'text', 'emoji');
    expect(emoji).toMatchObject({ text: '🤕', x: sticker.x, y: sticker.y, fontSize: r * NODE_TEXT_SCALE.stickerEmoji });
  });

  it('draws the observation icon on the sticker when the person has notes but no emoji', () => {
    const items = plan({ person: { name: 'Marta', observation: { emoji: null } } });
    expect(only(items, 'text', 'emoji')).toEqual([]);
    expect(only(items, 'icon').find((i) => i.icon === 'observation')).toBeDefined();
  });

  it('puts the move badge, an ink disc with the move icon, on the middle of the top edge', () => {
    const items = plan({ moveSource: true });
    const r = H * NODE_TEXT_SCALE.moveBadge;
    const y = -H / 2 + NODE_SKETCH_INSET - 1;
    expect(only(items, 'disc')).toContainEqual({ kind: 'disc', x: 0, y, radius: r, fill: theme.focus, stroke: null, strokeWidth: 0, raised: true });
    expect(only(items, 'icon').find((i) => i.icon === 'move')).toMatchObject({ x: 0, y, color: theme.onInk });
  });

  it('draws the badges above the text, and the move badge last', () => {
    const kinds = plan({ moveSource: true, conflict: true }).map((p) => ('role' in p ? p.role : 'icon' in p ? p.icon : p.kind));
    expect(kinds.indexOf('name')).toBeLessThan(kinds.indexOf('star'));
    expect(kinds[kinds.length - 1]).toBe('move');
  });

  it('draws nothing but the shape and its label for an empty position', () => {
    expect(plan({ person: null }).map((p) => p.kind)).toEqual(['shape', 'text']);
  });
});

describe('scaledNodeDrawPlan', () => {
  const projected = resolveNodeAppearance({ ...marta, mode: 'projection', person: { name: 'Montserrat' } }, theme);
  const ellipse = (scale: number) =>
    scaledNodeDrawPlan(projected, { width: W * scale, height: H * scale, shape: 'ELLIPSE', seed: SEED }, scale, theme, measure);

  it('lays a node shrunk to fit a small screen out as at its natural size, for the painter to scale: same name, same pen', () => {
    expect(ellipse(0.25)).toEqual(nodeDrawPlan(projected, { width: W, height: H, shape: 'ELLIPSE', seed: SEED }, theme, measure));
  });

  it('keeps a name that fits at the natural size whole, which the shrunk node alone would cut', () => {
    const shrunk = nodeDrawPlan(projected, { width: W / 4, height: H / 4, shape: 'ELLIPSE', seed: SEED }, theme, measure);
    expect(only(shrunk, 'text', 'name')[0].text).toMatch(/…$/);
    expect(only(ellipse(0.25), 'text', 'name')[0].text).toBe('Montserrat');
  });
});

describe('fitNodeName', () => {
  it('draws a short name at the largest size the node allows', () => {
    const { fontSize, text } = fitNodeName('Pep', 80, 40, measure);
    expect(fontSize).toBeCloseTo(40 * NODE_TEXT_SCALE.nameMax);
    expect(text).toBe('Pep');
  });

  it('shrinks a longer name until it fits between the side paddings', () => {
    const { fontSize, text } = fitNodeName('Maria José', 80, 40, measure);
    expect(text).toBe('Maria José');
    expect(fontSize).toBeLessThan(40 * NODE_TEXT_SCALE.nameMax);
    expect(fontSize).toBeGreaterThanOrEqual(40 * NODE_TEXT_SCALE.nameMin);
    expect(measure(text, fontSize)).toBeLessThanOrEqual(80 - 2 * NODE_TEXT_SCALE.namePaddingX);
  });

  it('stops at the smallest size and cuts the name with an ellipsis when it still does not fit', () => {
    const { fontSize, text } = fitNodeName('Bartomeu Ferrandis', 80, 40, measure);
    expect(fontSize).toBeCloseTo(40 * NODE_TEXT_SCALE.nameMin);
    expect(text.endsWith('…')).toBe(true);
    expect(text.startsWith('Bart')).toBe(true);
    expect(measure(text, fontSize)).toBeLessThanOrEqual(80 - 2 * NODE_TEXT_SCALE.namePaddingX);
  });

  it('never leaves a space before the ellipsis', () => {
    // At the smallest size, 'Bartomeu F…' is one letter too wide and the cut lands on the space.
    expect(fitNodeName('Bartomeu Ferrandis', 76, 40, measure).text).toBe('Bartomeu…');
  });

  it('scales with the node: half the height, half the type', () => {
    expect(fitNodeName('Pep', 80, 20, measure).fontSize).toBeCloseTo(20 * NODE_TEXT_SCALE.nameMax);
  });

  it('keeps at least one letter on a node too narrow for anything', () => {
    expect(fitNodeName('Vicent', 4, 40, measure).text).toBe('V…');
  });
});
