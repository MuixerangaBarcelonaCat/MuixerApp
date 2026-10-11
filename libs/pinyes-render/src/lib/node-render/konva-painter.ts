import Konva from 'konva';
import { DrawPrimitive } from './draw-plan';
import { NodeFill } from './appearance';
import { CanvasIcon, NODE_ICON_PATHS } from './icons';
import { nodeOutline } from './outline';
import { FigureLink, pinDiscs } from '../utils/figure-link.util';

/**
 * Konva side of the node renderer: turns a node draw plan (`nodeDrawPlan`, unit-tested) into Konva
 * shapes. Konva needs a real canvas, absent in jsdom, so this thin mapping is checked visually
 * like the rest of the canvas wiring.
 */


/** Lucide draws on a 24-unit grid. */
const ICON_GRID = 24;

/** Hatching for a pending node, as a Phase 2 stand-in for rough.js: lines 6 apart at −41°. */
const HATCH_GAP = 6;
const HATCH_WEIGHT = 1;
const HATCH_ANGLE = -41;
/** The hatch tile is drawn this many times larger and scaled down, so it stays crisp when zoomed in. */
const HATCH_RESOLUTION = 4;
const hatchTiles = new Map<string, HTMLCanvasElement>();

function hatchTile(color: string): HTMLCanvasElement {
  const cached = hatchTiles.get(color);
  if (cached) return cached;
  const size = HATCH_GAP * HATCH_RESOLUTION;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, (size - HATCH_WEIGHT * HATCH_RESOLUTION) / 2, size, HATCH_WEIGHT * HATCH_RESOLUTION);
  }
  hatchTiles.set(color, tile);
  return tile;
}

function fillConfig(fill: NodeFill): Konva.ShapeConfig {
  switch (fill.style) {
    case 'solid':
      return { fill: fill.color };
    case 'hatch':
      return {
        fillPatternImage: hatchTile(fill.color) as unknown as HTMLImageElement,
        fillPatternRepeat: 'repeat',
        fillPatternRotation: HATCH_ANGLE,
        fillPatternScale: { x: 1 / HATCH_RESOLUTION, y: 1 / HATCH_RESOLUTION },
      };
    case 'none':
      // Transparent, not absent: the node's inside must still catch clicks and drops.
      return { fill: 'transparent' };
  }
}

/** A node's outline shape, centred on (0, 0), from the geometry both painters share. */
export function createNodeShape(shape: string, w: number, h: number, config: Konva.ShapeConfig): Konva.Shape {
  const outline = nodeOutline(shape, w, h);
  switch (outline.kind) {
    case 'rect':
      return new Konva.Rect({ x: -w / 2, y: -h / 2, width: w, height: h, cornerRadius: outline.cornerRadius, ...config });
    case 'ellipse':
      return new Konva.Ellipse({ radiusX: outline.radiusX, radiusY: outline.radiusY, ...config });
    case 'polygon':
      return new Konva.Line({ points: outline.points, closed: true, ...config });
  }
}

/** A Lucide icon centred on (x, y), `size` wide; `strokeWidth` is on Lucide's 24-unit grid. */
export function drawIcon(p: { icon: CanvasIcon; x: number; y: number; size: number; color: string; filled: boolean; strokeWidth: number }): Konva.Group {
  const scale = p.size / ICON_GRID;
  const group = new Konva.Group({ x: p.x - p.size / 2, y: p.y - p.size / 2, scaleX: scale, scaleY: scale, listening: false });
  for (const data of NODE_ICON_PATHS[p.icon]) {
    group.add(
      new Konva.Path({
        data,
        stroke: p.color,
        strokeWidth: p.strokeWidth,
        fill: p.filled ? p.color : undefined,
        lineCap: 'round',
        lineJoin: 'round',
        listening: false,
      }),
    );
  }
  return group;
}

function drawText(p: Extract<DrawPrimitive, { kind: 'text' }>): Konva.Text {
  const left = p.align === 'center' ? p.x - p.boxWidth / 2 : p.x;
  return new Konva.Text({
    text: p.text,
    x: left,
    y: p.y - p.boxHeight / 2,
    width: p.boxWidth,
    height: p.boxHeight,
    fontSize: p.fontSize,
    fontFamily: p.fontFamily,
    fontStyle: p.fontStyle,
    fill: p.fill,
    align: p.align,
    verticalAlign: 'middle',
    wrap: p.wrap ? 'word' : 'none',
    ellipsis: p.wrap,
    lineHeight: p.wrap ? 1.1 : 1,
    ...(p.halo
      ? { stroke: p.halo.color, strokeWidth: p.halo.width, fillAfterStrokeEnabled: true, lineJoin: 'round' as const }
      : {}),
    listening: false,
  });
}

/**
 * Konva nodes for a draw plan, in drawing order. `nodes` starts with the node's outline shape, the
 * only one that listens to the pointer; `raised` holds what the plan raises above every node (the
 * observation sticker, the move badge), for the caller to put on a layer of its own.
 */
export function drawNodePlan(plan: DrawPrimitive[]): {
  shape: Konva.Shape;
  nodes: (Konva.Shape | Konva.Group)[];
  raised: (Konva.Shape | Konva.Group)[];
} {
  let shape: Konva.Shape | null = null;
  const flat: (Konva.Shape | Konva.Group)[] = [];
  const raised: (Konva.Shape | Konva.Group)[] = [];
  for (const p of plan) {
    const nodes = p.raised ? raised : flat;
    switch (p.kind) {
      case 'shape':
        shape = createNodeShape(p.shape, p.width, p.height, {
          ...fillConfig(p.fill),
          stroke: p.stroke,
          strokeWidth: p.strokeWidth,
          dash: p.dash ?? undefined,
        });
        nodes.push(shape);
        break;
      case 'loop':
        nodes.push(new Konva.Ellipse({ radiusX: p.radiusX, radiusY: p.radiusY, stroke: p.color, strokeWidth: p.width, listening: false }));
        break;
      case 'text':
        nodes.push(drawText(p));
        break;
      case 'strike':
        nodes.push(
          new Konva.Line({ points: [p.x1, p.y, p.x2, p.y], stroke: p.color, strokeWidth: p.width, lineCap: 'round', listening: false }),
        );
        break;
      case 'icon':
        nodes.push(drawIcon(p));
        break;
      case 'disc':
        nodes.push(drawDisc(p));
        break;
    }
  }
  if (!shape) throw new Error('A node draw plan starts with its shape.');
  return { shape, nodes: flat, raised };
}

function drawDisc(p: Extract<DrawPrimitive, { kind: 'disc' }>): Konva.Circle {
  return new Konva.Circle({
    x: p.x,
    y: p.y,
    radius: p.radius,
    fill: p.fill,
    stroke: p.stroke ?? undefined,
    strokeWidth: p.strokeWidth,
    listening: false,
  });
}

/**
 * The projection's tronc panel ↔ pinya link (`figureLink`): the sagging string, for a layer behind
 * the nodes, and the pin on the figure, for a layer above them.
 */
export function drawFigureLink(link: FigureLink): { string: Konva.Path; pin: Konva.Group } {
  const { from, control, to } = link.string;
  const string = new Konva.Path({
    data: `M${from.x} ${from.y} Q${control.x} ${control.y} ${to.x} ${to.y}`,
    stroke: link.stringColor,
    strokeWidth: link.stringWidth,
    lineCap: 'round',
    opacity: 0.9,
    listening: false,
  });
  const pin = new Konva.Group({ listening: false });
  for (const disc of pinDiscs(link.pin.x, link.pin.y, link.pinRadius, link.color)) pin.add(drawDisc(disc));
  return { string, pin };
}

let textProbe: Konva.Text | null = null;

/** Width of `text` drawn bold at `fontSize` in `fontFamily`, as Konva will draw it. */
export function measureText(text: string, fontSize: number, fontFamily: string): number {
  textProbe ??= new Konva.Text({ fontStyle: 'bold', listening: false });
  textProbe.fontFamily(fontFamily);
  textProbe.fontSize(fontSize);
  textProbe.text(text);
  return textProbe.getTextWidth();
}
