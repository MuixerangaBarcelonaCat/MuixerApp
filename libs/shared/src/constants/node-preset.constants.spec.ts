import { FigureZone } from '../enums/figure-zone.enum';
import { NodeShape } from '../enums/node-shape.enum';
import { TRONC_NODE_PRESETS, TRONC_Z_DEFAULTS, TroncNodePreset } from './ad-hoc-node.constants';
import { PINYA_NODE_PRESETS, DIRECTION_NODE_PRESETS, DECORATION_NODE_PRESETS } from './node-preset.constants';

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
  it('has exactly two entries (figure and xicalla)', () => {
    expect(DIRECTION_NODE_PRESETS.length).toBe(2);
  });

  it('covers both direction zones', () => {
    const zones = DIRECTION_NODE_PRESETS.map((p) => p.zone);
    expect(zones).toContain(FigureZone.FIGURE_DIRECTION);
    expect(zones).toContain(FigureZone.XICALLA_DIRECTION);
  });

  it('every preset has valid dimensions and a color', () => {
    for (const preset of DIRECTION_NODE_PRESETS) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(preset.color).toBeTruthy();
    }
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

  it('includes rectangle, arrow and circle shapes', () => {
    const shapes = DECORATION_NODE_PRESETS.map((p) => p.shape);
    expect(shapes).toContain(NodeShape.RECTANGLE);
    expect(shapes).toContain(NodeShape.ARROW);
    expect(shapes).toContain(NodeShape.CIRCLE);
  });
});
