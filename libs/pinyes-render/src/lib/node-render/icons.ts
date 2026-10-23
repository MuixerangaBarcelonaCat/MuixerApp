import { ArrowDown, ArrowLeftRight, CircleAlert, Move, Star } from 'lucide-angular';
import { NodeIcon } from './draw-plan';

/** A Lucide icon as `lucide-angular` exports it: a list of `[tag, attributes]` SVG elements on a 24-unit grid. */
export type LucideIconNodes = ReadonlyArray<readonly [string, Readonly<Record<string, string | number>>]>;

/**
 * The SVG path data of every element of a Lucide icon, in order, so a canvas can draw the icon
 * with one `Konva.Path` per element (scaled by `size / 24`). Elements with no outline to draw
 * are skipped.
 */
export function lucidePaths(icon: LucideIconNodes): string[] {
  return icon.flatMap(([tag, attrs]) => {
    const n = (key: string) => Number(attrs[key] ?? 0);
    switch (tag) {
      case 'path':
        return [String(attrs['d'])];
      case 'circle':
        return [ellipsePath(n('cx'), n('cy'), n('r'), n('r'))];
      case 'ellipse':
        return [ellipsePath(n('cx'), n('cy'), n('rx'), n('ry'))];
      case 'line':
        return [`M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`];
      case 'polyline':
        return [pointsPath(String(attrs['points']))];
      case 'polygon':
        return [pointsPath(String(attrs['points'])) + 'Z'];
      case 'rect':
        return [`M${n('x')} ${n('y')}h${n('width')}v${n('height')}h${-n('width')}Z`];
      default:
        return [];
    }
  });
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
}

function pointsPath(points: string): string {
  const values = points.trim().split(/[\s,]+/);
  const pairs: string[] = [];
  for (let i = 0; i + 1 < values.length; i += 2) pairs.push(`${values[i]} ${values[i + 1]}`);
  return 'M' + pairs.join('L');
}

/** Node icons, plus the drag pill's: swap with a placed person, or move into an empty node. */
export type CanvasIcon = NodeIcon | 'swap' | 'move-into';

/** SVG path data of every icon the node painters draw, on Lucide's 24-unit grid. */
export const NODE_ICON_PATHS: Record<CanvasIcon, string[]> = {
  star: lucidePaths(Star),
  conflict: lucidePaths(CircleAlert),
  move: lucidePaths(Move),
  observation: lucidePaths(CircleAlert),
  swap: lucidePaths(ArrowLeftRight),
  'move-into': lucidePaths(ArrowDown),
};
