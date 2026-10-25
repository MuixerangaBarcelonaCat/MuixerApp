import { DIRECTION_NODE_PRESETS, FigureZone, PINYA_NODE_PRESETS, TRONC_NODE_PRESETS } from '@muixer/shared';
import { NODE_TYPE_NEUTRAL, NODE_TYPE_NEUTRAL_DARK, NODE_TYPE_PALETTE, NODE_TYPE_PALETTE_DARK } from '@muixer/ui';
import { nodeFill, positionTypeColor, resolveNodeTones } from './node-color';

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

  it('takes the dark palette in dark mode, and keeps a customized color as it is', () => {
    expect(resolveNodeTones({ zone: FigureZone.PINYA, positionType: 'vents', color: null }, 'dark')).toEqual(NODE_TYPE_PALETTE_DARK['vents']);
    expect(resolveNodeTones({ zone: FigureZone.BASE, positionType: 'base', color: null }, 'dark')).toEqual(NODE_TYPE_NEUTRAL_DARK);
    expect(resolveNodeTones({ zone: FigureZone.TRONC, positionType: 'unknown', color: null }, 'dark')).toEqual(NODE_TYPE_NEUTRAL_DARK);
    expect(resolveNodeTones({ zone: FigureZone.PINYA, positionType: 'vents', color: '#123456' }, 'dark')).toEqual({
      wash: '#123456',
      pencil: '#123456',
    });
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

  it('takes the dark pencil in dark mode, which reads on a dark surface', () => {
    expect(positionTypeColor('vents', 'dark')).toBe(NODE_TYPE_PALETTE_DARK['vents'].pencil);
    expect(positionTypeColor('unknown', 'dark')).toBe(NODE_TYPE_NEUTRAL_DARK.pencil);
  });

  it('uses the neutral pencil for the base and for unknown types', () => {
    expect(positionTypeColor('base')).toBe(NODE_TYPE_NEUTRAL.pencil);
    expect(positionTypeColor('unknown')).toBe(NODE_TYPE_NEUTRAL.pencil);
  });
});

describe('nodeFill', () => {
  it('fills a typed node with the wash of its type', () => {
    expect(nodeFill({ zone: FigureZone.PINYA, positionType: 'mans', color: null })).toBe(NODE_TYPE_PALETTE['mans'].wash);
  });

  it('fills BASE nodes with the neutral wash', () => {
    expect(nodeFill({ zone: FigureZone.BASE, positionType: 'base', color: null })).toBe(NODE_TYPE_NEUTRAL.wash);
  });

  it('fills with the dark wash in dark mode', () => {
    expect(nodeFill({ zone: FigureZone.PINYA, positionType: 'mans', color: null }, 'dark')).toBe(NODE_TYPE_PALETTE_DARK['mans'].wash);
  });

  it('fills a customized node with its own color', () => {
    expect(nodeFill({ zone: FigureZone.PINYA, positionType: 'mans', color: '#123456' })).toBe('#123456');
  });

  it('leaves a decoration with no color unfilled, and fills one that has a color', () => {
    expect(nodeFill({ zone: FigureZone.DECORATION, positionType: 'circle', color: null })).toBe('transparent');
    expect(nodeFill({ zone: FigureZone.DECORATION, positionType: 'circle', color: '#123456' })).toBe('#123456');
  });
});
