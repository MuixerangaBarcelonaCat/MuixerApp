import { FigureZone } from '@muixer/shared';
import { CanvasTheme, buildCanvasTheme, contentOn } from './canvas-theme';
import { resolveNodeTones } from './node-color';

type PaintableNode = { zone: string; positionType: string | null | undefined; color: string | null };

const THEME = buildCanvasTheme();

/** A node's fill: the wash of its type, its customized color, or nothing for an uncolored decoration. */
export function nodeFill(node: PaintableNode): string {
  if (node.zone === FigureZone.DECORATION) return node.color ?? 'transparent';
  return resolveNodeTones(node).wash;
}

/** Ink or paper for the text on a node, whichever reads on its fill. */
export function nodeLabelColor(node: PaintableNode): string {
  const fill = nodeFill(node);
  return fill === 'transparent' ? THEME.ink : contentOn(fill);
}

/**
 * The attendance dot of an assigned node. Before the arrival phase it says whether the person said
 * they'd come; during it, whether they're here yet. No dot once they're here.
 */
export function attendanceDotColor(status: string | undefined, arrivalPhase: boolean, theme: CanvasTheme): string | null {
  switch (status) {
    case 'ANIRE':
      return arrivalPhase ? theme.warning : theme.success;
    case 'PENDENT':
      return arrivalPhase ? theme.danger : theme.warning;
    case 'NO_VAIG':
      return theme.danger;
    default:
      return null;
  }
}
