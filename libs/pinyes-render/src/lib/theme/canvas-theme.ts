import { CREASE, INK, NODE_TYPE_NEUTRAL, NodeTones, PAPER, SEMANTIC, contrastContent, formatHex, hexToOklch } from '@muixer/ui';

/**
 * The colors the figure canvas and the tronc panel draw with, by role. Konva can't read CSS
 * variables, so the canvas takes token values from here instead of from the DaisyUI theme. Every
 * value is a 6-digit hex: Konva's color parser and rough.js both take it.
 *
 * Light only for now: the canvas is pinned to the light theme until it gets a dark look of its own
 * (DEBT.md F19).
 */
export interface CanvasTheme {
  /** Canvas background. */
  paper: string;
  /** Grid lines. */
  crease: string;
  /** Outlines and text. */
  ink: string;
  /** Secondary labels: figure names, slot labels. */
  inkMuted: string;
  /** Placeholders and faint frames. */
  inkFaint: string;
  /** Text and strokes drawn on an ink surface (tooltips, the drag pill, badges). */
  onInk: string;
  /** The node being acted on: selected, the rotation handle. */
  focus: string;
  /** Conflicts. */
  danger: string;
  /** Dark marks on a node (the next-actuació star) and the drag pill: a step softer than the text. */
  nodeOutline: string;
  /** Backdrop of an observation emoji, and its edge. */
  sticker: string;
  stickerEdge: string;
  /** The flat paper edge under a tronc panel card, and the card's frame. */
  cardEdge: string;
  cardBorder: string;
  /** Nodes with no type color: BASE nodes. */
  neutralNode: NodeTones;
}

export function buildCanvasTheme(): CanvasTheme {
  return {
    paper: PAPER.white,
    crease: CREASE.light,
    ink: INK.black,
    inkMuted: INK.mid,
    inkFaint: INK.light,
    onInk: PAPER.white,
    focus: INK.black,
    danger: SEMANTIC.error,
    nodeOutline: INK.dark,
    sticker: PAPER.white,
    stickerEdge: CREASE.mid,
    cardEdge: PAPER.washiDark,
    cardBorder: CREASE.light,
    neutralNode: NODE_TYPE_NEUTRAL,
  };
}

const INK_OKLCH = hexToOklch(INK.black);
const PAPER_OKLCH = hexToOklch(PAPER.white);

/** Ink or paper, whichever reads better on a hex fill (APCA, like the rest of the app's content colors). */
export function contentOn(fillHex: string): string {
  return contrastContent(hexToOklch(fillHex), INK_OKLCH, PAPER_OKLCH) === INK_OKLCH ? INK.black : PAPER.white;
}

/** `hex` moved a share `t` of the way toward `paper`, mixed in OKLab: how a mark fades into the page. */
export function fade(hex: string, t: number, paper: string): string {
  const [l1, a1, b1] = toOklab(hex);
  const [l2, a2, b2] = toOklab(paper);
  const l = l1 + (l2 - l1) * t;
  const a = a1 + (a2 - a1) * t;
  const b = b1 + (b2 - b1) * t;
  return formatHex({ l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 });
}

function toOklab(hex: string): [number, number, number] {
  const { l, c, h } = hexToOklch(hex);
  const rad = ((h || 0) * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

/** A 6-digit hex with an alpha channel appended, for a translucent canvas fill. */
export function withAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}
