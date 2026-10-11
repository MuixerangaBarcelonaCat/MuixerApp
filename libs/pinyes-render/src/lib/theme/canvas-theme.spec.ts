import { CREASE, INK, NODE_TYPE_NEUTRAL, PAPER, SEMANTIC, hexToOklch } from '@muixer/ui';
import { buildCanvasTheme, contentOn, fade, withAlpha } from './canvas-theme';

describe('buildCanvasTheme', () => {
  const theme = buildCanvasTheme();

  it('draws on paper, with the grid in a crease tone', () => {
    expect(theme.paper).toBe(PAPER.white);
    expect(theme.crease).toBe(CREASE.light);
  });

  it('writes in ink, with muted and faint steps for secondary text', () => {
    expect(theme.ink).toBe(INK.black);
    expect(theme.inkMuted).toBe(INK.mid);
    expect(theme.inkFaint).toBe(INK.light);
    expect(theme.onInk).toBe(PAPER.white);
  });

  it('marks the node being acted on in ink, not in a colla color', () => {
    expect(theme.focus).toBe(INK.black);
  });

  it('takes conflicts from the semantic error token', () => {
    expect(theme.danger).toBe(SEMANTIC.error);
  });

  it('outlines a filled node in dark ink, a step softer than the text', () => {
    expect(theme.nodeOutline).toBe(INK.dark);
  });

  it('puts observations on a paper sticker with a crease edge', () => {
    expect(theme.sticker).toBe(PAPER.white);
    expect(theme.stickerEdge).toBe(CREASE.mid);
  });

  it('gives untyped nodes (BASE, tronc panel) the neutral paper tones', () => {
    expect(theme.neutralNode).toEqual(NODE_TYPE_NEUTRAL);
  });

  it('returns only hex colors, which Konva and rough.js both parse', () => {
    const values = Object.values(theme).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)));
    for (const value of values) expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('fade', () => {
  it('leaves a color as it is at 0 and turns it into paper at 1', () => {
    expect(fade('#296b33', 0, PAPER.white).toLowerCase()).toBe('#296b33');
    expect(fade('#296b33', 1, PAPER.white).toLowerCase()).toBe(PAPER.white.toLowerCase());
  });

  it('mixes in OKLab: halfway is lighter than the color and darker than the paper', () => {
    const half = hexToOklch(fade('#296b33', 0.45, PAPER.white)).l;
    expect(half).toBeGreaterThan(hexToOklch('#296b33').l);
    expect(half).toBeLessThan(hexToOklch(PAPER.white).l);
    expect(fade('#296b33', 0.45, PAPER.white)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('contentOn', () => {
  it('writes in ink on a light fill', () => {
    expect(contentOn(PAPER.washiDark)).toBe(INK.black);
    expect(contentOn('#e7d7a7')).toBe(INK.black);
  });

  it('writes in paper on a dark fill', () => {
    expect(contentOn(INK.dark)).toBe(PAPER.white);
    expect(contentOn('#1E3A8A')).toBe(PAPER.white);
  });
});

describe('withAlpha', () => {
  it('appends the alpha as a two-digit hex channel', () => {
    expect(withAlpha('#1C1B18', 0.55)).toBe('#1C1B188c');
    expect(withAlpha('#c74007', 0.05)).toBe('#c740070d');
    expect(withAlpha('#c74007', 1)).toBe('#c74007ff');
  });
});
