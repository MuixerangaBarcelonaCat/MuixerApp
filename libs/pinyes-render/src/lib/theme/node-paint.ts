import { EventPhase, FigureZone, isStartedPhase } from '@muixer/shared';
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
 * The attendance dot of an assigned node. Until the event starts it says whether the person said
 * they'd come; from then on, whether they're here yet. No dot once they're here.
 */
export function attendanceDotColor(status: string | undefined, phase: EventPhase, theme: CanvasTheme): string | null {
  const started = isStartedPhase(phase);
  switch (status) {
    case 'ANIRE':
      return started ? theme.warning : theme.success;
    case 'PENDENT':
      return started ? theme.danger : theme.warning;
    case 'NO_VAIG':
      return theme.danger;
    default:
      return null;
  }
}
