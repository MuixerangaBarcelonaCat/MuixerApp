import { FigureZone } from '../enums/figure-zone.enum';
import { NodeShape } from '../enums/node-shape.enum';
import { TRONC_NODE_PRESETS, TRONC_Z_DEFAULTS, TroncNodePreset, PINYA_NODE_PRESETS, DIRECTION_NODE_PRESETS, DIRECTION_SLOTS, DIRECTION_POSITION_TYPES, DECORATION_NODE_PRESETS, DECORATION_POSITION_TYPES } from './node-preset.constants';

describe('TRONC_NODE_PRESETS', () => {
  it('has at least 5 presets', () => {
    expect(TRONC_NODE_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it('has no duplicate positionType values', () => {
    const types = TRONC_NODE_PRESETS.map((p) => p.positionType);
    expect(new Set(types).size).toBe(types.length);
  });

  it('has non-empty positionType, label, color and abbrev for each preset', () => {
    for (const preset of TRONC_NODE_PRESETS) {
      expect(preset.positionType.length).toBeGreaterThan(0);
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.color.length).toBeGreaterThan(0);
      expect(preset.abbrev.length).toBeGreaterThan(0);
    }
  });

  it('has valid hex color codes', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const preset of TRONC_NODE_PRESETS) {
      expect(preset.color).toMatch(hexRegex);
    }
  });

  it('includes the expected position types', () => {
    const types = TRONC_NODE_PRESETS.map((p) => p.positionType);
    expect(types).toContain('segona');
    expect(types).toContain('terça');
    expect(types).toContain('quarta');
    expect(types).toContain('quinta');
    expect(types).toContain('sisena');
    expect(types).toContain('puntal');
    expect(types).toContain('xiqueta');
  });

  it('satisfies the TroncNodePreset interface shape', () => {
    const preset: TroncNodePreset = TRONC_NODE_PRESETS[0];
    expect(typeof preset.positionType).toBe('string');
    expect(typeof preset.label).toBe('string');
    expect(typeof preset.color).toBe('string');
    expect(typeof preset.abbrev).toBe('string');
  });
});

describe('TRONC_Z_DEFAULTS', () => {
  it('resolves all z-levels to a valid preset', () => {
    for (const [z, preset] of Object.entries(TRONC_Z_DEFAULTS)) {
      expect(preset).toBeDefined();
      expect(preset.positionType.length).toBeGreaterThan(0);
      expect(Number(z)).toBeGreaterThan(0);
    }
  });

  it('every z-level preset exists in TRONC_NODE_PRESETS', () => {
    const types = TRONC_NODE_PRESETS.map((p) => p.positionType);
    for (const preset of Object.values(TRONC_Z_DEFAULTS)) {
      expect(types).toContain(preset.positionType);
    }
  });
});

describe('PINYA_NODE_PRESETS', () => {
  it('has at least one preset', () => {
    expect(PINYA_NODE_PRESETS.length).toBeGreaterThan(0);
  });

  it('every preset has zone PINYA', () => {
    for (const preset of PINYA_NODE_PRESETS) {
      expect(preset.zone).toBe(FigureZone.PINYA);
    }
  });

  it('has no duplicate positionType values', () => {
    const types = PINYA_NODE_PRESETS.map((p) => p.positionType);
    expect(new Set(types).size).toBe(types.length);
  });

  it('has valid dimensions for each preset', () => {
    for (const preset of PINYA_NODE_PRESETS) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
    }
  });

  it('includes the expected position types', () => {
    const types = PINYA_NODE_PRESETS.map((p) => p.positionType);
    expect(types).toContain('agulla');
    expect(types).toContain('mans');
    expect(types).toContain('laterals');
    expect(types).toContain('vents');
    expect(types).toContain('cordo-obert');
    expect(types).toContain('tap');
    expect(types).toContain('crossa');
    expect(types).toContain('contrafort');
  });

  it('cordo-obert uses ellipse shape', () => {
    const cordo = PINYA_NODE_PRESETS.find((p) => p.positionType === 'cordo-obert');
    expect(cordo?.shape).toBe(NodeShape.ELLIPSE);
  });

  it('non-comodin presets have a non-empty label', () => {
    for (const preset of PINYA_NODE_PRESETS.filter((p) => !p.requiresCustomLabel)) {
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it('comodin preset requires a custom label', () => {
    const comodin = PINYA_NODE_PRESETS.find((p) => p.positionType === 'comodin');
    expect(comodin?.requiresCustomLabel).toBe(true);
  });
});

describe('DIRECTION_NODE_PRESETS', () => {
  it('includes the tronc, xicalla and pinya flavours', () => {
    expect(DIRECTION_POSITION_TYPES).toContain('direccio-tronc');
    expect(DIRECTION_POSITION_TYPES).toContain('direccio-xicalla');
    expect(DIRECTION_POSITION_TYPES).toContain('direccio-pinya');
  });

  it('gives direccio-pinya a deep green (emerald-800) and the "Direcció pinya" label', () => {
    const pinya = DIRECTION_NODE_PRESETS.find((p) => p.positionType === 'direccio-pinya')!;
    expect(pinya.color).toBe('#065f46');
    expect(pinya.label).toBe('Direcció pinya');
    expect(pinya.shortLabel).toBe('Pinya');
  });

  it('every preset lives in the single DIRECTION zone', () => {
    for (const preset of DIRECTION_NODE_PRESETS) {
      expect(preset.zone).toBe(FigureZone.DIRECTION);
    }
  });

  it('has no duplicate positionType values', () => {
    const types = DIRECTION_NODE_PRESETS.map((p) => p.positionType);
    expect(new Set(types).size).toBe(types.length);
  });

  it('every preset has valid dimensions, a color, a short label and a slot order', () => {
    for (const preset of DIRECTION_NODE_PRESETS) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(preset.color).toBeTruthy();
      expect(preset.shortLabel.length).toBeGreaterThan(0);
      expect(typeof preset.slotOrder).toBe('number');
    }
  });
});

describe('DIRECTION_SLOTS', () => {
  it('holds every direction preset, ordered by slotOrder', () => {
    expect(DIRECTION_SLOTS.map((s) => s.positionType)).toEqual(
      [...DIRECTION_NODE_PRESETS].sort((a, b) => a.slotOrder - b.slotOrder).map((s) => s.positionType),
    );
  });

  it('orders the flavours tronc → xicalla → pinya', () => {
    const order = DIRECTION_SLOTS.map((s) => s.positionType);
    expect(order.indexOf('direccio-tronc')).toBeLessThan(order.indexOf('direccio-xicalla'));
    expect(order.indexOf('direccio-xicalla')).toBeLessThan(order.indexOf('direccio-pinya'));
  });
});

describe('DECORATION_NODE_PRESETS', () => {
  it('has at least one preset', () => {
    expect(DECORATION_NODE_PRESETS.length).toBeGreaterThan(0);
  });

  it('every preset has zone DECORATION', () => {
    for (const preset of DECORATION_NODE_PRESETS) {
      expect(preset.zone).toBe(FigureZone.DECORATION);
    }
  });

  it('every preset requires a custom label', () => {
    for (const preset of DECORATION_NODE_PRESETS) {
      expect(preset.requiresCustomLabel).toBe(true);
    }
  });

  it('includes every decoration shape', () => {
    const shapes = DECORATION_NODE_PRESETS.map((p) => p.shape);
    expect(shapes).toContain(NodeShape.RECTANGLE);
    expect(shapes).toContain(NodeShape.ARROW);
    expect(shapes).toContain(NodeShape.ARROW_LEFT);
    expect(shapes).toContain(NodeShape.ARROW_UP);
    expect(shapes).toContain(NodeShape.ARROW_DOWN);
    expect(shapes).toContain(NodeShape.DOUBLE_ARROW);
    expect(shapes).toContain(NodeShape.TRIANGLE);
    expect(shapes).toContain(NodeShape.STAR);
    expect(shapes).toContain(NodeShape.CIRCLE);
  });

  it('gives arrow-up and arrow-down a wide, short default (a broad head) instead of mirroring left/right rotated 90°', () => {
    const up = DECORATION_NODE_PRESETS.find((p) => p.positionType === 'arrow-up')!;
    const down = DECORATION_NODE_PRESETS.find((p) => p.positionType === 'arrow-down')!;
    expect(up.width).toBeGreaterThan(up.height);
    expect(down.width).toBeGreaterThan(down.height);
  });

  it('every preset has a positionType accepted by the backend', () => {
    for (const preset of DECORATION_NODE_PRESETS) {
      expect(DECORATION_POSITION_TYPES).toContain(preset.positionType);
    }
  });
});
