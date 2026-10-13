import { FONT_FAMILY } from '@muixer/ui';
import { CanvasTheme } from '../theme/canvas-theme';
import { NodeAppearance, NodeFill } from './appearance';
import { nodeOutline } from './outline';
import { SketchPath, sketchDisc, sketchLoop, sketchShape } from './sketch';

/**
 * Sizes on a figure node, as fractions of the node's height, so a node reads the same at every
 * zoom and on every screen. The pinya canvas and the tronc panel share them: a name of the same
 * length is the same visual size in both views.
 */
export const NODE_TEXT_SCALE = {
  /** Person name in the projection (Atkinson 700): auto-fit between these two sizes. */
  nameMax: 0.42,
  nameMin: 0.26,
  /** Person name everywhere else (Quicksand 700): one size for every name. */
  nameUniform: 0.28,
  /** Decoration text in the projection (Atkinson 700, wrapped): auto-fit between these two sizes. */
  captionMax: 0.45,
  captionMin: 0.1,
  /** Space kept clear on each side of the name, in world units. */
  namePaddingX: 6,
  /** Position label of an empty node (Quicksand, uppercase). */
  label: 0.24,
  /** Shoulder height, top-left. */
  height: 0.27,
  /** Next-actuació star, bottom-left. */
  star: 0.22,
  /** Conflict icon, bottom-right. */
  conflictIcon: 0.32,
  /** Observation sticker radius; the emoji is drawn at `stickerEmoji ×` that radius. */
  stickerRadius: 0.27,
  stickerEmoji: 1.25,
  /** Move badge radius, on the top edge. */
  moveBadge: 0.2,
} as const;

/**
 * The size and text of a person's name on a node of `width × height`: the largest size up to
 * `nameMax` at which it fits between the side paddings, and never below `nameMin`. A name that
 * still doesn't fit at `nameMin` is cut with an ellipsis.
 *
 * @param measure - the width of `text` drawn at `fontSize`.
 */
export function fitNodeName(
  name: string,
  width: number,
  height: number,
  measure: (text: string, fontSize: number) => number,
): { fontSize: number; text: string } {
  const max = height * NODE_TEXT_SCALE.nameMax;
  const min = height * NODE_TEXT_SCALE.nameMin;
  const available = width - 2 * NODE_TEXT_SCALE.namePaddingX;

  const widthAtMax = measure(name, max);
  if (widthAtMax <= available) return { fontSize: max, text: name };

  const fitted = (max * available) / widthAtMax;
  if (fitted >= min) return { fontSize: fitted, text: name };

  return { fontSize: min, text: ellipsize(name, min, available, measure) };
}

/** `text` cut with «…» until it fits `available` at `fontSize`; unchanged when it already fits. */
function ellipsize(text: string, fontSize: number, available: number, measure: (text: string, fontSize: number) => number): string {
  if (measure(text, fontSize) <= available) return text;
  let cut = text;
  while (cut.length > 1 && measure(cut + '…', fontSize) > available) cut = cut.slice(0, -1);
  return cut.trimEnd() + '…';
}

export type NodeIcon = 'star' | 'conflict' | 'move' | 'observation';

/**
 * One thing to draw for a node, in node-local coordinates: (0, 0) is the node's centre, x grows to
 * the right and y downwards. A renderer draws a plan's primitives in order, each over the last.
 */
export type DrawPrimitive = (
  | {
      kind: 'shape';
      shape: string;
      width: number;
      height: number;
      fill: NodeFill;
      stroke: string;
      strokeWidth: number;
      dash: number[] | null;
      /** The fill and the outline drawn with the pen: what a painter draws. */
      sketch: SketchPath[];
    }
  | {
      kind: 'text';
      role: 'name' | 'label' | 'caption' | 'height' | 'emoji';
      text: string;
      /** Centre of the text for `center`, left edge for `left`; y is always the vertical centre. */
      x: number;
      y: number;
      /** The box the text is laid out in (wrapped text only fills it). */
      boxWidth: number;
      boxHeight: number;
      fontSize: number;
      fontFamily: string;
      fontStyle: 'normal' | 'bold';
      fill: string;
      align: 'center' | 'left';
      /** A paper ring around the letters, so hatching never crosses them. */
      halo: { color: string; width: number } | null;
      wrap: boolean;
    }
  | { kind: 'strike'; x1: number; x2: number; y: number; color: string; width: number }
  /** A Lucide icon centred on (x, y), `size` wide; `strokeWidth` is on Lucide's 24-unit grid. */
  | { kind: 'icon'; icon: NodeIcon; x: number; y: number; size: number; color: string; filled: boolean; strokeWidth: number }
  /** A clean disc, or, with a `sketch`, a pen-drawn one (the observation sticker). */
  | { kind: 'disc'; x: number; y: number; radius: number; fill: string; stroke: string | null; strokeWidth: number; sketch?: SketchPath[] }
  /** An ellipse around the node, drawn with the pen (`sketch`). */
  | { kind: 'loop'; radiusX: number; radiusY: number; color: string; width: number; sketch: SketchPath[] }
) & {
  /**
   * Straddles the node's edge (the observation sticker, the move badge): a painter draws it on a
   * layer above every node, so a neighbouring node never covers it.
   */
  raised?: true;
};

/**
 * How far inside its footprint a standard node's outline is drawn, on each side: about the reach of
 * the pen's wobble, so two neighbouring nodes never touch. The footprint (clicks, drops, text) stays.
 */
export const NODE_SKETCH_INSET = 2;

const NAME_FONT = FONT_FAMILY.legible.join(', ');
const SANS_FONT = FONT_FAMILY.sans.join(', ');
/** Node height the line widths are tuned for; smaller nodes get proportionally thinner lines. */
const REFERENCE_HEIGHT = 40;
/** Halo width as a share of the font size. */
const HALO = 0.32;

/**
 * A node on a canvas whose node sizes carry a fit-to-screen `scale` (the projection shrinks every
 * node to fit the segment on the screen): its plan laid out at the node's natural size, for the
 * painter to scale by `scale`. What is sized in fixed units (the name's side padding, the pen's
 * wobble) then keeps its proportion to the node, so a phone draws the same node as a big screen.
 */
export function scaledNodeDrawPlan(
  appearance: NodeAppearance,
  size: { width: number; height: number; shape: string; seed?: number },
  scale: number,
  theme: CanvasTheme,
  measure: (text: string, fontSize: number, fontFamily: string) => number,
): DrawPrimitive[] {
  return nodeDrawPlan(appearance, { ...size, width: size.width / scale, height: size.height / scale }, theme, measure);
}

/**
 * Lays a node's appearance out as primitives, with the anatomy every view shares: height top-left,
 * observation sticker on the top-right corner, name centred, star bottom-left, conflict icon
 * bottom-right, the move badge on the top edge. The outline is drawn `NODE_SKETCH_INSET` inside the
 * node, and the sticker and the badge sit on that drawn edge.
 *
 * Shapes, the conflict loop and the sticker are drawn with the pen (`sketch`), seeded by `size.seed`
 * (a hash of the node's id), so a node's strokes stay the same from one render to the next.
 *
 * @param measure - the width of `text` drawn bold at `fontSize` in `fontFamily`; the renderer supplies it.
 */
export function nodeDrawPlan(
  appearance: NodeAppearance,
  size: { width: number; height: number; shape: string; seed?: number },
  theme: CanvasTheme,
  measure: (text: string, fontSize: number, fontFamily: string) => number,
): DrawPrimitive[] {
  const { width: w, height: h, seed = 1 } = size;
  const lineScale = Math.min(1, h / REFERENCE_HEIGHT);
  const inset = NODE_SKETCH_INSET * lineScale;
  const outline = {
    fill: appearance.fill,
    stroke: appearance.outline.color,
    strokeWidth: appearance.outline.width * lineScale,
    dash: appearance.outline.dash,
  };
  const plan: DrawPrimitive[] = [
    {
      kind: 'shape',
      shape: size.shape,
      width: w,
      height: h,
      ...outline,
      // The hatching follows the node's height, uncapped like the text: one density at every size.
      sketch: sketchShape(nodeOutline(size.shape, w - 2 * inset, h - 2 * inset), { ...outline, hatchScale: h / REFERENCE_HEIGHT }, seed),
    },
  ];

  if (appearance.conflictLoop) {
    // Close around the node and thin: it marks the node without shouting over its neighbours.
    const [radiusX, radiusY, width] = [(w + 14) / 2, (h + 16) / 2, 1.4 * lineScale];
    plan.push({
      kind: 'loop',
      radiusX,
      radiusY,
      color: theme.danger,
      width,
      raised: true,
      sketch: sketchLoop(radiusX, radiusY, theme.danger, width, seed + 6),
    });
  }

  const { text } = appearance;
  if (text.kind === 'name') {
    const fontFamily = text.typeface === 'legible' ? NAME_FONT : SANS_FONT;
    const measureName = (t: string, fontSize: number) => measure(t, fontSize, fontFamily);
    const uniform = h * NODE_TEXT_SCALE.nameUniform;
    const fitted =
      text.typeface === 'legible'
        ? fitNodeName(text.value, w, h, measureName)
        : { fontSize: uniform, text: ellipsize(text.value, uniform, w - 2 * NODE_TEXT_SCALE.namePaddingX, measureName) };
    plan.push({
      kind: 'text',
      role: 'name',
      text: fitted.text,
      x: 0,
      y: 0,
      boxWidth: w,
      boxHeight: h,
      fontSize: fitted.fontSize,
      fontFamily,
      fontStyle: 'bold',
      fill: text.color,
      align: 'center',
      halo: halo(text.halo, fitted.fontSize),
      wrap: false,
    });
    if (text.strike) {
      const half = measureName(fitted.text, fitted.fontSize) / 2;
      plan.push({
        kind: 'strike',
        x1: -half - 2,
        x2: half + 2,
        y: h * 0.02,
        color: theme.inkMuted,
        width: Math.max(1, fitted.fontSize * 0.09),
      });
    }
  } else if (text.kind === 'caption') {
    const box = { width: w - 8, height: h - 8 };
    const legible = text.typeface === 'legible';
    const fontFamily = legible ? NAME_FONT : SANS_FONT;
    // Staffing and editing: the size of a name on a standard node, so a big decoration doesn't
    // shout. The projection: as large as the decoration holds, read from a distance.
    const fontSize = legible
      ? fitWrapped(text.value, box, h * NODE_TEXT_SCALE.captionMax, h * NODE_TEXT_SCALE.captionMin, (t, fs) => measure(t, fs, fontFamily))
      : Math.min(h, REFERENCE_HEIGHT) * NODE_TEXT_SCALE.nameUniform;
    plan.push({
      kind: 'text',
      role: 'caption',
      text: text.value,
      x: 0,
      y: 0,
      boxWidth: box.width,
      boxHeight: box.height,
      fontSize,
      fontFamily,
      fontStyle: 'bold',
      fill: text.color,
      align: 'center',
      halo: null,
      wrap: true,
    });
  } else {
    plan.push({
      kind: 'text',
      role: 'label',
      text: text.uppercase ? text.value.toUpperCase() : text.value,
      x: 0,
      y: 0,
      boxWidth: w - 8,
      boxHeight: h - 8,
      fontSize: h * NODE_TEXT_SCALE.label,
      fontFamily: SANS_FONT,
      fontStyle: 'bold',
      fill: text.color,
      align: 'center',
      halo: null,
      wrap: true,
    });
  }

  if (appearance.height) {
    const fontSize = h * NODE_TEXT_SCALE.height;
    plan.push({
      kind: 'text',
      role: 'height',
      text: appearance.height,
      x: -w / 2 + 4,
      y: -h / 2 + 2 + fontSize / 2,
      boxWidth: w / 2,
      boxHeight: fontSize * 1.2,
      fontSize,
      fontFamily: SANS_FONT,
      fontStyle: 'bold',
      fill: theme.inkMuted,
      align: 'left',
      halo: halo(text.halo, fontSize),
      wrap: false,
    });
  }

  if (appearance.star) {
    plan.push({
      kind: 'icon',
      icon: 'star',
      x: -w / 2 + h * 0.17,
      y: h / 2 - h * 0.17,
      size: h * NODE_TEXT_SCALE.star,
      color: theme.nodeOutline,
      filled: true,
      strokeWidth: 1.5,
    });
  }

  if (appearance.conflictIcon) {
    plan.push({
      kind: 'icon',
      icon: 'conflict',
      x: w / 2 - h * 0.22,
      y: h / 2 - h * 0.24,
      size: h * NODE_TEXT_SCALE.conflictIcon,
      color: theme.danger,
      filled: false,
      strokeWidth: 2.4,
    });
  }

  if (appearance.observation) {
    const r = h * NODE_TEXT_SCALE.stickerRadius;
    const x = w / 2 - inset - r * 0.95;
    const y = -h / 2 + inset + r * 0.12;
    const sticker = { x, y, radius: r, fill: theme.sticker, stroke: theme.stickerEdge, strokeWidth: 1 };
    plan.push({ kind: 'disc', ...sticker, raised: true, sketch: sketchDisc(sticker, seed + 3) });
    const emoji = appearance.observation.emoji;
    if (emoji) {
      const fontSize = r * NODE_TEXT_SCALE.stickerEmoji;
      plan.push({
        kind: 'text',
        role: 'emoji',
        text: emoji,
        x,
        y,
        boxWidth: r * 2,
        boxHeight: r * 2,
        fontSize,
        fontFamily: SANS_FONT,
        fontStyle: 'normal',
        fill: theme.ink,
        align: 'center',
        halo: null,
        wrap: false,
        raised: true,
      });
    } else {
      plan.push({ kind: 'icon', icon: 'observation', x, y, size: r * 1.3, color: theme.inkMuted, filled: false, strokeWidth: 2.4, raised: true });
    }
  }

  if (appearance.moveBadge) {
    const r = h * NODE_TEXT_SCALE.moveBadge;
    const y = -h / 2 + inset - 1;
    plan.push({ kind: 'disc', x: 0, y, radius: r, fill: theme.focus, stroke: null, strokeWidth: 0, raised: true });
    plan.push({ kind: 'icon', icon: 'move', x: 0, y, size: r * 1.35, color: theme.onInk, filled: false, strokeWidth: 2.6, raised: true });
  }

  return plan;
}

/** Line height of wrapped text, as a share of the font size (both painters use it). */
const WRAP_LINE_HEIGHT = 1.1;

/**
 * The largest size, from `max` down to `min` in half-unit steps, at which `text` wrapped at word
 * boundaries fits `box`: no word wider than the box, and every line inside its height.
 */
function fitWrapped(
  text: string,
  box: { width: number; height: number },
  max: number,
  min: number,
  measure: (text: string, fontSize: number) => number,
): number {
  const words = text.split(/\s+/).filter(Boolean);
  for (let fs = max; fs > min; fs -= 0.5) {
    let lines = 1;
    let line = '';
    let fits = true;
    for (const word of words) {
      if (measure(word, fs) > box.width) {
        fits = false;
        break;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, fs) <= box.width) {
        line = candidate;
      } else {
        lines++;
        line = word;
      }
    }
    if (fits && lines * fs * WRAP_LINE_HEIGHT <= box.height) return fs;
  }
  return min;
}

function halo(color: string | null, fontSize: number): { color: string; width: number } | null {
  return color ? { color, width: fontSize * HALO } : null;
}
