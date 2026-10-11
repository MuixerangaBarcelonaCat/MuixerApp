import { CREASE, INK, NODE_TYPE_NEUTRAL, NodeTones, PAPER, SEMANTIC, contrastContent, hexToOklch } from '@muixer/ui';

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
  /** Positive state: confirmed attendance, a move target, the move source. */
  success: string;
  /** Attention: pending attendance, a swap target, observations. */
  warning: string;
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
    success: SEMANTIC.success,
    warning: SEMANTIC.warning,
    neutralNode: NODE_TYPE_NEUTRAL,
  };
}

const INK_OKLCH = hexToOklch(INK.black);
const PAPER_OKLCH = hexToOklch(PAPER.white);

/** Ink or paper, whichever reads better on a hex fill (APCA, like the rest of the app's content colors). */
export function contentOn(fillHex: string): string {
  return contrastContent(hexToOklch(fillHex), INK_OKLCH, PAPER_OKLCH) === INK_OKLCH ? INK.black : PAPER.white;
}

/** A 6-digit hex with an alpha channel appended, for a translucent canvas fill. */
export function withAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}
