import { TRONC_NODE_PRESETS, TroncNodePreset } from './tronc-node-presets';

describe('TRONC_NODE_PRESETS', () => {
  it('should have at least 5 presets', () => {
    expect(TRONC_NODE_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it('should have no duplicate positionType values', () => {
    const types = TRONC_NODE_PRESETS.map((p) => p.positionType);
    expect(new Set(types).size).toBe(types.length);
  });

  it('should have non-empty positionType, label, and color for each preset', () => {
    for (const preset of TRONC_NODE_PRESETS) {
      expect(preset.positionType.length).toBeGreaterThan(0);
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.color.length).toBeGreaterThan(0);
    }
  });

  it('should have valid hex color codes', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const preset of TRONC_NODE_PRESETS) {
      expect(preset.color).toMatch(hexRegex);
    }
  });

  it('should include the expected position types', () => {
    const types = TRONC_NODE_PRESETS.map((p) => p.positionType);
    expect(types).toContain('segones');
    expect(types).toContain('terceres');
    expect(types).toContain('quartes');
    expect(types).toContain('quintes');
    expect(types).toContain('puntal');
    expect(types).toContain('xiqueta');
  });

  it('should satisfy the TroncNodePreset interface shape', () => {
    const preset: TroncNodePreset = TRONC_NODE_PRESETS[0];
    expect(typeof preset.positionType).toBe('string');
    expect(typeof preset.label).toBe('string');
    expect(typeof preset.color).toBe('string');
  });
});
