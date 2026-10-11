import { NodeShape } from '@muixer/shared';
import { nodeOutline } from './outline';

describe('nodeOutline', () => {
  it('draws a rectangle by default, corners rounded to a tenth of its shorter side', () => {
    expect(nodeOutline(NodeShape.RECTANGLE, 80, 40)).toEqual({ kind: 'rect', width: 80, height: 40, cornerRadius: 4 });
    expect(nodeOutline('anything', 80, 40)).toEqual({ kind: 'rect', width: 80, height: 40, cornerRadius: 4 });
  });

  it('draws an ellipse filling the box, and a circle filling its shorter side', () => {
    expect(nodeOutline(NodeShape.ELLIPSE, 80, 40)).toEqual({ kind: 'ellipse', radiusX: 40, radiusY: 20 });
    expect(nodeOutline(NodeShape.CIRCLE, 80, 40)).toEqual({ kind: 'ellipse', radiusX: 20, radiusY: 20 });
  });

  it('draws the arrows and the triangle as polygons centred on the node', () => {
    expect(nodeOutline(NodeShape.ARROW, 80, 40)).toEqual({ kind: 'polygon', points: [-40, -20, 20, -20, 40, 0, 20, 20, -40, 20] });
    expect(nodeOutline(NodeShape.ARROW_LEFT, 80, 40)).toEqual({ kind: 'polygon', points: [40, -20, -20, -20, -40, 0, -20, 20, 40, 20] });
    expect(nodeOutline(NodeShape.ARROW_UP, 80, 40)).toEqual({ kind: 'polygon', points: [-40, 20, -40, -10, 0, -20, 40, -10, 40, 20] });
    expect(nodeOutline(NodeShape.ARROW_DOWN, 80, 40)).toEqual({ kind: 'polygon', points: [-40, -20, -40, 10, 0, 20, 40, 10, 40, -20] });
    expect(nodeOutline(NodeShape.DOUBLE_ARROW, 80, 40)).toEqual({
      kind: 'polygon',
      points: [-40, 0, -20, -20, 20, -20, 40, 0, 20, 20, -20, 20],
    });
    expect(nodeOutline(NodeShape.TRIANGLE, 80, 40)).toEqual({ kind: 'polygon', points: [0, -20, 40, 20, -40, 20] });
  });

  it('draws a five-pointed star in the shorter side, its first point straight up', () => {
    const star = nodeOutline(NodeShape.STAR, 80, 40);
    expect(star.kind).toBe('polygon');
    const points = (star as { points: number[] }).points;
    expect(points).toHaveLength(20);
    expect(points[0]).toBeCloseTo(0);
    expect(points[1]).toBeCloseTo(-20);
    // Inner points sit at half the outer radius.
    expect(Math.hypot(points[2], points[3])).toBeCloseTo(10);
  });
});
