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

  it('returns true for direction nodes', () => {
    expect(isNodeColorEditable({ zone: FigureZone.DIRECTION, positionType: 'direccio-tronc' })).toBe(true);
    expect(isNodeColorEditable({ zone: FigureZone.DIRECTION, positionType: 'direccio-xicalla' })).toBe(true);
  });

  it('returns true for DECORATION nodes', () => {
    expect(isNodeColorEditable({ zone: FigureZone.DECORATION, positionType: 'rectangle' })).toBe(true);
  });
});
