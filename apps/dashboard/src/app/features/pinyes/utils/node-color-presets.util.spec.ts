import { describe, it, expect } from 'vitest';
import { FigureZone } from '@muixer/shared';
import { isNodeColorEditable } from './node-color-presets.util';

describe('isNodeColorEditable', () => {
  it('returns false for BASE nodes', () => {
    expect(isNodeColorEditable({ zone: FigureZone.BASE, positionType: 'base' })).toBe(false);
  });

  it('returns true for PINYA nodes regardless of positionType', () => {
    expect(isNodeColorEditable({ zone: FigureZone.PINYA, positionType: 'agulla' })).toBe(true);
  });

  it('returns true for TRONC nodes', () => {
    expect(isNodeColorEditable({ zone: FigureZone.TRONC, positionType: 'segona' })).toBe(true);
  });

  it('returns true for FIGURE_DIRECTION nodes', () => {
    expect(isNodeColorEditable({ zone: FigureZone.FIGURE_DIRECTION, positionType: 'direccio-figura' })).toBe(true);
  });

  it('returns true for XICALLA_DIRECTION nodes', () => {
    expect(isNodeColorEditable({ zone: FigureZone.XICALLA_DIRECTION, positionType: 'direccio-xicalla' })).toBe(true);
  });

  it('returns true for DECORATION nodes', () => {
    expect(isNodeColorEditable({ zone: FigureZone.DECORATION, positionType: 'rectangle' })).toBe(true);
  });
});
