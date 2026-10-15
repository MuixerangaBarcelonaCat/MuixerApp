import { NodeShape } from '@muixer/shared';

/** A node's outline, centred on (0, 0): the geometry both painters (Konva and SVG) draw. */
export type NodeOutline =
  | { kind: 'rect'; width: number; height: number; cornerRadius: number }
  | { kind: 'ellipse'; radiusX: number; radiusY: number }
  /** Flat list of x, y pairs. */
  | { kind: 'polygon'; points: number[] };

export function nodeOutline(shape: string, w: number, h: number): NodeOutline {
  switch (shape) {
    case NodeShape.ARROW:
      return { kind: 'polygon', points: [-w / 2, -h / 2, w / 4, -h / 2, w / 2, 0, w / 4, h / 2, -w / 2, h / 2] };
    case NodeShape.ARROW_LEFT:
      // ARROW mirrored horizontally (every x negated) so the tip points left.
      return { kind: 'polygon', points: [w / 2, -h / 2, -w / 4, -h / 2, -w / 2, 0, -w / 4, h / 2, w / 2, h / 2] };
    case NodeShape.ARROW_UP:
      // ARROW rotated -90°: travel along h, tip at (0,-h/2), flat base at y=h/2, shoulders at y=-h/4.
      return { kind: 'polygon', points: [-w / 2, h / 2, -w / 2, -h / 4, 0, -h / 2, w / 2, -h / 4, w / 2, h / 2] };
    case NodeShape.ARROW_DOWN:
      // ARROW_UP mirrored vertically (every y negated) so the tip points down.
      return { kind: 'polygon', points: [-w / 2, -h / 2, -w / 2, h / 4, 0, h / 2, w / 2, h / 4, w / 2, -h / 2] };
    case NodeShape.DOUBLE_ARROW:
      // ARROW tapered at both ends instead of one flat edge.
      return { kind: 'polygon', points: [-w / 2, 0, -w / 4, -h / 2, w / 4, -h / 2, w / 2, 0, w / 4, h / 2, -w / 4, h / 2] };
    case NodeShape.TRIANGLE:
      return { kind: 'polygon', points: [0, -h / 2, w / 2, h / 2, -w / 2, h / 2] };
    case NodeShape.STAR:
      return { kind: 'polygon', points: starPoints(Math.min(w, h) / 2) };
    case NodeShape.CIRCLE:
      return { kind: 'ellipse', radiusX: Math.min(w, h) / 2, radiusY: Math.min(w, h) / 2 };
    case NodeShape.ELLIPSE:
      return { kind: 'ellipse', radiusX: w / 2, radiusY: h / 2 };
    default:
      return { kind: 'rect', width: w, height: h, cornerRadius: Math.min(w, h) * 0.1 };
  }
}

/** Five points, inner radius half the outer one, first point straight up. */
function starPoints(outer: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : outer / 2;
    const angle = (i * Math.PI) / 5;
    points.push(r * Math.sin(angle), -r * Math.cos(angle));
  }
  return points;
}
