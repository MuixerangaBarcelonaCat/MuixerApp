import Konva from 'konva';
import { SceneCanvas } from 'konva/lib/Canvas';
import { DrawPrimitive } from './draw-plan';
import { CanvasIcon, NODE_ICON_PATHS } from './icons';
import { NodeOutline, nodeOutline } from './outline';
import { SketchPath } from './sketch';
import { FigureLink, pinDiscs } from '../utils/figure-link.util';
import { CanvasTheme } from '../theme/canvas-theme';
import { Rect } from '../utils/underlay.util';

/**
 * Konva side of the node renderer: turns a node draw plan (`nodeDrawPlan`, unit-tested) into Konva
 * shapes. Konva needs a real canvas, absent in jsdom, so this thin mapping is checked visually
 * like the rest of the canvas wiring.
 */


/** Lucide draws on a 24-unit grid. */
const ICON_GRID = 24;

/** Parsed path data, by its `d`: a node redrawn unchanged doesn't parse its strokes again. */
const paths2d = new Map<string, Path2D>();
const PATH_CACHE_LIMIT = 8000;

function path2d(d: string): Path2D {
  let path = paths2d.get(d);
  if (!path) {
    if (paths2d.size >= PATH_CACHE_LIMIT) paths2d.delete(paths2d.keys().next().value as string);
    path = new Path2D(d);
    paths2d.set(d, path);
  }
  return path;
}

function paintSketch(ctx: CanvasRenderingContext2D, sketch: SketchPath[]): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of sketch) {
    const path = path2d(p.d);
    if (p.fill) {
      ctx.fillStyle = p.fill;
      ctx.fill(path);
    }
    if (p.stroke) {
      ctx.strokeStyle = p.stroke;
      ctx.lineWidth = p.strokeWidth;
      ctx.setLineDash(p.dash ?? []);
      ctx.stroke(path);
    }
  }
  ctx.setLineDash([]);
}

function traceOutline(ctx: Konva.Context, outline: NodeOutline): void {
  ctx.beginPath();
  switch (outline.kind) {
    case 'rect':
      ctx.rect(-outline.width / 2, -outline.height / 2, outline.width, outline.height);
      break;
    case 'ellipse':
      ctx.ellipse(0, 0, outline.radiusX, outline.radiusY, 0, 0, Math.PI * 2, false);
      break;
    case 'polygon':
      ctx.moveTo(outline.points[0], outline.points[1]);
      for (let i = 2; i < outline.points.length; i += 2) ctx.lineTo(outline.points[i], outline.points[i + 1]);
      break;
  }
  ctx.closePath();
}

/**
 * Pen-drawn paths (centred on (0, 0)) as one Konva shape. It sits at the corner of `box` and is
 * `box` big, so the group's bounds (fit to screen, drop targets) see the node's real size. With a
 * `hit` outline it listens to the pointer over that plain outline, inside included, never over the
 * wobbly strokes: a node with no fill still catches clicks and drops, and hit-testing stays cheap.
 */
function sketchNode(sketch: SketchPath[], box: { width: number; height: number }, hit?: { outline: NodeOutline; strokeWidth: number }): Konva.Shape {
  const [dx, dy] = [box.width / 2, box.height / 2];
  return new Konva.Shape({
    x: -dx,
    y: -dy,
    width: box.width,
    height: box.height,
    perfectDrawEnabled: false,
    sceneFunc: (context) => {
      const ctx = context._context;
      ctx.translate(dx, dy);
      paintSketch(ctx, sketch);
      ctx.translate(-dx, -dy);
    },
    ...(hit
      ? {
          hitFunc: (context: Konva.Context, shape: Konva.Shape) => {
            context.translate(dx, dy);
            traceOutline(context, hit.outline);
            context.fillStrokeShape(shape);
            context.translate(-dx, -dy);
          },
          // Read by the hit graph only: the scene is the sketch.
          fill: 'black',
          stroke: 'black',
          strokeWidth: hit.strokeWidth,
        }
      : { listening: false }),
  });
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
        shape = sketchNode(p.sketch, p, { outline: nodeOutline(p.shape, p.width, p.height), strokeWidth: p.strokeWidth });
        nodes.push(shape);
        break;
      case 'loop':
        nodes.push(sketchNode(p.sketch, { width: p.radiusX * 2, height: p.radiusY * 2 }));
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
        // The sticker is drawn with the pen; the move badge stays a clean ink disc.
        nodes.push(p.sketch ? sketchNode(p.sketch, { width: 0, height: 0 }) : drawDisc(p));
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
export function drawFigureLink(link: FigureLink, theme: CanvasTheme): { string: Konva.Path; pin: Konva.Group } {
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
  for (const disc of pinDiscs(link.pin.x, link.pin.y, link.pinRadius, link.color, theme)) pin.add(drawDisc(disc));
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

/**
 * The visible `layers`, composited into one canvas covering `rect` (stage-container px, i.e.
 * screen px at the stage's transform) at `pixelRatio`. Drawn straight into a single canvas: Konva's
 * own `toCanvas` gives each layer a canvas of its own, plus a buffer as big as the region and its
 * offset, which an old phone can't spare. Each shape multiplies its transform onto the context, so
 * translating it first is all the offset needs; `Container.drawScene`, not the layer's own, which
 * would clear the canvas between layers.
 */
export function drawLayersRegion(layers: Konva.Layer[], rect: Rect, pixelRatio: number): HTMLCanvasElement {
  const out = new SceneCanvas({ width: rect.width, height: rect.height, pixelRatio });
  out.getContext().translate(-rect.x, -rect.y);
  for (const layer of layers) {
    if (layer.isVisible()) Konva.Container.prototype.drawScene.call(layer, out);
  }
  return out._canvas;
}
