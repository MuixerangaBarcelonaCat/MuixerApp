import { DIRECTION_NODE_PRESETS, FigureZone, PINYA_NODE_PRESETS, TRONC_NODE_PRESETS } from '@muixer/shared';
import { NODE_TYPE_NEUTRAL, NODE_TYPE_PALETTE } from '@muixer/ui';
import { positionTypeColor, resolveNodeTones } from './node-color';

describe('resolveNodeTones', () => {
  it('uses the type palette for a node whose color was never customized', () => {
    expect(resolveNodeTones({ zone: FigureZone.PINYA, positionType: 'vents', color: null })).toEqual(NODE_TYPE_PALETTE['vents']);
    expect(resolveNodeTones({ zone: FigureZone.TRONC, positionType: 'segona', color: null })).toEqual(NODE_TYPE_PALETTE['segona']);
    expect(resolveNodeTones({ zone: FigureZone.DIRECTION, positionType: 'direccio-pinya', color: null })).toEqual(
      NODE_TYPE_PALETTE['direccio-pinya'],
    );
  });

  it('draws a customized color as it is, for both tones', () => {
    expect(resolveNodeTones({ zone: FigureZone.PINYA, positionType: 'vents', color: '#123456' })).toEqual({
      wash: '#123456',
      pencil: '#123456',
    });
  });

  it('always draws BASE nodes in the neutral tones: their color is not editable', () => {
    expect(resolveNodeTones({ zone: FigureZone.BASE, positionType: 'base', color: null })).toEqual(NODE_TYPE_NEUTRAL);
    expect(resolveNodeTones({ zone: FigureZone.BASE, positionType: 'base', color: '#EEEEEE' })).toEqual(NODE_TYPE_NEUTRAL);
  });

  it('falls back to the neutral tones for a type with no palette entry', () => {
    expect(resolveNodeTones({ zone: FigureZone.PINYA, positionType: null, color: null })).toEqual(NODE_TYPE_NEUTRAL);
    expect(resolveNodeTones({ zone: FigureZone.TRONC, positionType: 'unknown', color: null })).toEqual(NODE_TYPE_NEUTRAL);
  });

  it('has a palette entry for every pinya, tronc and direction preset', () => {
    const types = [...PINYA_NODE_PRESETS, ...TRONC_NODE_PRESETS, ...DIRECTION_NODE_PRESETS].map((p) => p.positionType as string);
    for (const type of types) expect(NODE_TYPE_PALETTE[type]).toBeDefined();
  });
});

describe('positionTypeColor', () => {
  it('stands for a position type outside the canvas with its pencil tone', () => {
    expect(positionTypeColor('vents')).toBe(NODE_TYPE_PALETTE['vents'].pencil);
    expect(positionTypeColor('direccio-tronc')).toBe(NODE_TYPE_PALETTE['direccio-tronc'].pencil);
  });

  it('uses the neutral pencil for the base and for unknown types', () => {
    expect(positionTypeColor('base')).toBe(NODE_TYPE_NEUTRAL.pencil);
    expect(positionTypeColor('unknown')).toBe(NODE_TYPE_NEUTRAL.pencil);
  });
});
