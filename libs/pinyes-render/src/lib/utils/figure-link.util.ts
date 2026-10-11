import { INK, PAPER } from '@muixer/ui';
import { buildCanvasTheme, fade } from '../theme/canvas-theme';
import { DrawPrimitive } from '../node-render/draw-plan';

/**
 * The projection's link between a tronc panel and its pinya: a string in the figure colour, from a
 * pin on the panel card to a pin on the figure's corner nearest the panel. Everything here is in
 * one coordinate space (the canvas world), with no Konva and no DOM.
 */

/** Pin radius and string width at natural size (one panel pixel). */
export const PIN_RADIUS = 9;
const STRING_WIDTH = 2;
/** How far the string sags: its control point drops this share of its length. */
const STRING_SAG = 0.1;

const THEME = buildCanvasTheme();

export interface Point {
  x: number;
  y: number;
}

/** A rectangle by its top-left corner. */
export interface LinkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A figure node by its centre, as the canvas draws it: rotated (degrees) around that centre. */
export interface LinkNode {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Someone stands on it. */
  occupied: boolean;
}

export type CardEdge = 'top' | 'bottom' | 'left' | 'right';

export interface FigureLink {
  /** The card edge whose middle holds the card pin, the string's first end. */
  cardEdge: CardEdge;
  string: { from: Point; control: Point; to: Point };
  stringColor: string;
  stringWidth: number;
  /** The pin on the figure. */
  pin: Point;
  pinRadius: number;
  color: string;
}

/**
 * The corner of the figure closest to the panel: every corner of every occupied node (of every node
 * while nobody is placed), the first one found winning a tie.
 */
export function nearestFigureCorner(nodes: LinkNode[], panel: LinkRect): Point | null {
  const occupied = nodes.filter((n) => n.occupied);
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (const n of occupied.length > 0 ? occupied : nodes) {
    for (const corner of nodeCorners(n)) {
      const distance = distanceToRect(corner, panel);
      if (distance < bestDistance) {
        best = corner;
        bestDistance = distance;
      }
    }
  }
  return best;
}

/**
 * Where the card pin goes: the middle of the card edge facing `target`, its centre on the edge — the
 * edge a line from the card's centre to `target` leaves through. The string then always leaves the
 * card outward, never across the names on it.
 */
export function cardPin(card: LinkRect, target: Point): Point & { edge: CardEdge } {
  const cx = card.x + card.width / 2;
  const cy = card.y + card.height / 2;
  const dx = (target.x - cx) / (card.width / 2);
  const dy = (target.y - cy) / (card.height / 2);
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { edge: 'right', x: card.x + card.width, y: cy } : { edge: 'left', x: card.x, y: cy };
  }
  return dy > 0 ? { edge: 'bottom', x: cx, y: card.y + card.height } : { edge: 'top', x: cx, y: card.y };
}

/** A string that sags a little, like real thread: a quadratic curve whose control point drops. */
export function stringCurve(from: Point, to: Point): FigureLink['string'] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    from,
    control: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + STRING_SAG * length },
    to,
  };
}

/**
 * The link from a panel card to its figure, `scale` being canvas-world units per panel pixel.
 * `null` for a figure with no nodes, which has nothing to pin.
 */
export function figureLink(nodes: LinkNode[], card: LinkRect, color: string, scale: number): FigureLink | null {
  const pin = nearestFigureCorner(nodes, card);
  if (!pin) return null;
  const { edge, x, y } = cardPin(card, pin);
  return {
    cardEdge: edge,
    string: stringCurve({ x, y }, pin),
    stringColor: fade(color, 0.2, INK.dark),
    stringWidth: STRING_WIDTH * scale,
    pin,
    pinRadius: PIN_RADIUS * scale,
    color,
  };
}

/**
 * A pin head drawn flat: a paper shadow offset down-right, the head in the figure colour with a
 * darker rim, and a small highlight. Both painters draw it: Konva on the canvas, SVG on the card.
 */
export function pinDiscs(x: number, y: number, radius: number, color: string): Extract<DrawPrimitive, { kind: 'disc' }>[] {
  const k = radius / PIN_RADIUS;
  return [
    { kind: 'disc', x: x + 1.5 * k, y: y + 2.2 * k, radius, fill: PAPER.washiDark, stroke: null, strokeWidth: 0 },
    { kind: 'disc', x, y, radius, fill: color, stroke: pinRimColor(color), strokeWidth: k },
    { kind: 'disc', x: x - 3 * k, y: y - 3 * k, radius: 2.6 * k, fill: fade(color, 0.8, THEME.paper), stroke: null, strokeWidth: 0 },
  ];
}

/** The dark tone of a figure colour: its pin's rim, also the rule under its card's name band. */
export function pinRimColor(color: string): string {
  return fade(color, 0.35, INK.black);
}

function nodeCorners(n: LinkNode): Point[] {
  const rad = (n.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = n.width / 2;
  const hh = n.height / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([lx, ly]) => ({ x: n.x + lx * cos - ly * sin, y: n.y + lx * sin + ly * cos }));
}

function distanceToRect(p: Point, r: LinkRect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
}
