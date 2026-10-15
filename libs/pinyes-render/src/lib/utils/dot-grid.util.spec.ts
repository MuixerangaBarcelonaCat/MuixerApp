import { dotGrid } from './dot-grid.util';

const view = { left: -35, top: 10, right: 165, bottom: 95 };

describe('dotGrid', () => {
  it('puts a dot on every grid crossing of the visible world, a little past each edge', () => {
    const grid = dotGrid(view, 20, 1);
    expect(grid.step).toBe(20);
    expect(grid.xs[0]).toBeLessThanOrEqual(view.left);
    expect(grid.xs[grid.xs.length - 1]).toBeGreaterThanOrEqual(view.right);
    expect(grid.ys[0]).toBeLessThanOrEqual(view.top);
    expect(grid.ys[grid.ys.length - 1]).toBeGreaterThanOrEqual(view.bottom);
  });

  it('keeps the dots on world multiples of the step, so they travel with the figure while panning', () => {
    const grid = dotGrid(view, 20, 1);
    expect([...grid.xs, ...grid.ys].every((v) => v % 20 === 0)).toBe(true);
    expect(grid.xs[1] - grid.xs[0]).toBe(20);
  });

  it('keeps a dot the same size on screen at any zoom', () => {
    expect(dotGrid(view, 20, 1).radius).toBeCloseTo(1.1);
    expect(dotGrid(view, 20, 4).radius * 4).toBeCloseTo(1.1);
    expect(dotGrid(view, 20, 0.5).radius * 0.5).toBeCloseTo(1.1);
  });

  it('thins out zoomed out, doubling the step until dots sit at least 12 screen pixels apart', () => {
    expect(dotGrid(view, 20, 0.6).step).toBe(20);
    expect(dotGrid(view, 20, 0.5).step).toBe(40);
    expect(dotGrid(view, 20, 0.25).step).toBe(80);
  });
});
