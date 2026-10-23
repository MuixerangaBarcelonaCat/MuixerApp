import { CircleAlert, Star } from 'lucide-angular';
import { NODE_ICON_PATHS, lucidePaths } from './icons';

describe('lucidePaths', () => {
  it('keeps a path element as it is', () => {
    expect(lucidePaths(Star)).toEqual([(Star[0][1] as { d: string }).d]);
  });

  it('turns circles and lines into path data, in the icon order', () => {
    expect(lucidePaths(CircleAlert)).toEqual([
      'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0Z',
      'M12 8L12 12',
      'M12 16L12.01 16',
    ]);
  });

  it('turns polylines, polygons, rects and ellipses into path data', () => {
    expect(
      lucidePaths([
        ['polyline', { points: '1 2 3 4 5 6' }],
        ['polygon', { points: '1,2 3,4 5,6' }],
        ['rect', { x: '2', y: '3', width: '4', height: '5' }],
        ['ellipse', { cx: '12', cy: '12', rx: '4', ry: '2' }],
      ]),
    ).toEqual(['M1 2L3 4L5 6', 'M1 2L3 4L5 6Z', 'M2 3h4v5h-4Z', 'M8 12a4 2 0 1 0 8 0a4 2 0 1 0 -8 0Z']);
  });

  it('skips elements it cannot draw', () => {
    expect(lucidePaths([['text', { x: '0' }]])).toEqual([]);
  });
});

describe('NODE_ICON_PATHS', () => {
  it('marks a conflict with the circled «!» the rest of the app uses for conflicts', () => {
    expect(NODE_ICON_PATHS.conflict).toEqual(lucidePaths(CircleAlert));
  });
});
