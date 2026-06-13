import { stageToScreen, screenToStage, isCentralNode } from './rengla-coordinates.util';

describe('rengla-coordinates.util', () => {
  describe('stageToScreen', () => {
    it('returns identity coords when transform is neutral', () => {
      const result = stageToScreen(100, 50, { x: 0, y: 0, scaleX: 1, scaleY: 1 });
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('applies zoom (scale) correctly', () => {
      const result = stageToScreen(100, 50, { x: 0, y: 0, scaleX: 2, scaleY: 2 });
      expect(result).toEqual({ x: 200, y: 100 });
    });

    it('applies pan (offset) correctly', () => {
      const result = stageToScreen(100, 50, { x: 10, y: 20, scaleX: 1, scaleY: 1 });
      expect(result).toEqual({ x: 110, y: 70 });
    });

    it('applies both zoom and pan', () => {
      const result = stageToScreen(100, 50, { x: 10, y: 20, scaleX: 1.5, scaleY: 1.5 });
      expect(result).toEqual({ x: 160, y: 95 });
    });

    it('handles zero scale', () => {
      const result = stageToScreen(100, 50, { x: 5, y: 3, scaleX: 0, scaleY: 0 });
      expect(result).toEqual({ x: 5, y: 3 });
    });
  });

  describe('screenToStage', () => {
    it('returns identity coords when transform is neutral', () => {
      const result = screenToStage(100, 50, { x: 0, y: 0, scaleX: 1, scaleY: 1 });
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('inverts zoom (scale) correctly', () => {
      const result = screenToStage(200, 100, { x: 0, y: 0, scaleX: 2, scaleY: 2 });
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('inverts pan (offset) correctly', () => {
      const result = screenToStage(110, 70, { x: 10, y: 20, scaleX: 1, scaleY: 1 });
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('inverts both zoom and pan', () => {
      const result = screenToStage(160, 95, { x: 10, y: 20, scaleX: 1.5, scaleY: 1.5 });
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('round-trips with stageToScreen', () => {
      const transform = { x: 42, y: 18, scaleX: 1.25, scaleY: 1.25 };
      const stage = { x: 300, y: 150 };
      const screen = stageToScreen(stage.x, stage.y, transform);
      expect(screenToStage(screen.x, screen.y, transform)).toEqual(stage);
    });
  });

  describe('isCentralNode', () => {
    it('returns true for agulla', () => {
      expect(isCentralNode('agulla')).toBe(true);
    });

    it('returns true for crossa', () => {
      expect(isCentralNode('crossa')).toBe(true);
    });

    it('returns true for contrafort', () => {
      expect(isCentralNode('contrafort')).toBe(true);
    });

    it('returns false for tap', () => {
      expect(isCentralNode('tap')).toBe(false);
    });

    it('returns false for mans', () => {
      expect(isCentralNode('mans')).toBe(false);
    });

    it('returns false for vents', () => {
      expect(isCentralNode('vents')).toBe(false);
    });

    it('returns false for laterals', () => {
      expect(isCentralNode('laterals')).toBe(false);
    });

    it('returns false for cordo-obert', () => {
      expect(isCentralNode('cordo-obert')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isCentralNode(null)).toBe(false);
    });
  });
});
