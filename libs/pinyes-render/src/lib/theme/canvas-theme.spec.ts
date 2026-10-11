import { CREASE, INK, NODE_TYPE_NEUTRAL, PAPER, SEMANTIC } from '@muixer/ui';
import { buildCanvasTheme, contentOn, withAlpha } from './canvas-theme';

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

  it('takes conflict, success and warning from the semantic tokens', () => {
    expect(theme.danger).toBe(SEMANTIC.error);
    expect(theme.success).toBe(SEMANTIC.success);
    expect(theme.warning).toBe(SEMANTIC.warning);
  });

  it('gives untyped nodes (BASE, tronc panel) the neutral paper tones', () => {
    expect(theme.neutralNode).toEqual(NODE_TYPE_NEUTRAL);
  });

  it('returns only hex colors, which Konva and rough.js both parse', () => {
    const values = Object.values(theme).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)));
    for (const value of values) expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
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
