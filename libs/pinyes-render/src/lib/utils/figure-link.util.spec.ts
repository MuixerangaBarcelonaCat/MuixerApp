import { INK, PAPER } from '@muixer/ui';
import { buildCanvasTheme, fade } from '../theme/canvas-theme';
import {
  LinkNode,
  PIN_RADIUS,
  cardPin,
  figureLink,
  nearestFigureCorner,
  pinDiscs,
  stringCurve,
} from './figure-link.util';

const theme = buildCanvasTheme();

/** A node centred on (x, y), 80 × 40 like a pinya node, occupied unless said otherwise. */
const node = (x: number, y: number, extra: Partial<LinkNode> = {}): LinkNode => ({
  x,
  y,
  width: 80,
  height: 40,
  rotation: 0,
  occupied: true,
  ...extra,
});

/** A panel 200 × 100 whose top-left corner is at (x, y). */
const panel = (x: number, y: number) => ({ x, y, width: 200, height: 100 });

describe('nearestFigureCorner', () => {
  it('pins the corner of the figure closest to the panel', () => {
    // Panel above and to the left: the top-left corner of the top-left node.
    const nodes = [node(0, 0), node(100, 0), node(0, 60), node(100, 60)];
    expect(nearestFigureCorner(nodes, panel(-400, -300))).toEqual({ x: -40, y: -20 });
  });

  it('takes the corner closest to the panel rectangle, not to its centre', () => {
    // A wide panel straight above the right-hand node: its corners are equally far from the
    // panel's bottom edge, so the left one (first found) wins over a node further away.
    const nodes = [node(0, 200), node(300, 100)];
    expect(nearestFigureCorner(nodes, { x: -500, y: -100, width: 900, height: 100 })).toEqual({ x: 260, y: 80 });
  });

  it('applies the node rotation to its corners', () => {
    // Rotated 90°: an 80 × 40 node now stands 40 wide and 80 tall.
    const corner = nearestFigureCorner([node(0, 0, { rotation: 90 })], panel(-100, -300));
    expect(corner?.x).toBeCloseTo(20);
    expect(corner?.y).toBeCloseTo(-40);
  });

  it('only counts nodes someone stands on', () => {
    const nodes = [node(0, 0, { occupied: false }), node(0, 200)];
    expect(nearestFigureCorner(nodes, panel(-100, -300))).toEqual({ x: -40, y: 180 });
  });

  it('falls back to every node when nobody is placed yet', () => {
    const nodes = [node(0, 0, { occupied: false }), node(0, 200, { occupied: false })];
    expect(nearestFigureCorner(nodes, panel(-100, -300))).toEqual({ x: -40, y: -20 });
  });

  it('has nowhere to pin a figure with no nodes', () => {
    expect(nearestFigureCorner([], panel(0, 0))).toBeNull();
  });
});

describe('cardPin', () => {
  const card = panel(0, 0); // centre (100, 50)

  it('pins the middle of the card edge facing the figure, its centre on the edge', () => {
    expect(cardPin(card, { x: 100, y: 400 })).toEqual({ edge: 'bottom', x: 100, y: 100 });
    expect(cardPin(card, { x: 100, y: -400 })).toEqual({ edge: 'top', x: 100, y: 0 });
    expect(cardPin(card, { x: 600, y: 60 })).toEqual({ edge: 'right', x: 200, y: 50 });
    expect(cardPin(card, { x: -600, y: 60 })).toEqual({ edge: 'left', x: 0, y: 50 });
  });

  it('picks the edge a line from the card centre leaves through, so a wide card prefers top and bottom', () => {
    // 45° down-right from the centre: on a 200 × 100 card that line leaves through the bottom.
    expect(cardPin(card, { x: 400, y: 350 }).edge).toBe('bottom');
  });
});

describe('stringCurve', () => {
  it('sags: the control point drops a tenth of the string length below the midpoint', () => {
    expect(stringCurve({ x: 0, y: 0 }, { x: 300, y: 400 })).toEqual({
      from: { x: 0, y: 0 },
      control: { x: 150, y: 250 },
      to: { x: 300, y: 400 },
    });
  });
});

describe('figureLink', () => {
  it('ties the card pin to the nearest corner with a sagging string, sized and coloured for the figure', () => {
    const link = figureLink([node(0, 400)], panel(-100, 0), '#3b6fc2', 0.5);
    expect(link).toEqual({
      cardEdge: 'bottom',
      string: stringCurve({ x: 0, y: 100 }, { x: -40, y: 380 }),
      stringColor: fade('#3b6fc2', 0.2, INK.dark),
      stringWidth: 1,
      pin: { x: -40, y: 380 },
      pinRadius: PIN_RADIUS * 0.5,
      color: '#3b6fc2',
    });
  });

  it('draws no link for a figure with no nodes', () => {
    expect(figureLink([], panel(0, 0), '#3b6fc2', 1)).toBeNull();
  });
});

describe('pinDiscs', () => {
  it('draws a pin as a flat paper shadow, a rimmed head in the figure colour and a small highlight', () => {
    const [shadow, head, highlight] = pinDiscs(10, 20, 9, '#3b6fc2');
    expect(shadow).toMatchObject({ kind: 'disc', x: 11.5, y: 22.2, radius: 9, fill: PAPER.washiDark, stroke: null });
    expect(head).toMatchObject({
      kind: 'disc',
      x: 10,
      y: 20,
      radius: 9,
      fill: '#3b6fc2',
      stroke: fade('#3b6fc2', 0.35, INK.black),
      strokeWidth: 1,
    });
    expect(highlight).toMatchObject({ kind: 'disc', x: 7, y: 17, radius: 2.6, fill: fade('#3b6fc2', 0.8, theme.paper) });
  });

  it('scales the shadow offset and the highlight with the pin', () => {
    const [shadow, , highlight] = pinDiscs(0, 0, 4.5, '#3b6fc2');
    expect(shadow).toMatchObject({ x: 0.75, y: 1.1 });
    expect(highlight).toMatchObject({ x: -1.5, y: -1.5, radius: 1.3 });
  });
});
