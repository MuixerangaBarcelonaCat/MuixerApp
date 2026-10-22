import { CREASE, INK, NODE_TYPE_NEUTRAL, NODE_TYPE_NEUTRAL_DARK, PAPER, SEMANTIC, hexToOklch } from '@muixer/ui';
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

  it('lays a tronc panel card on a flat edge of darker paper, framed in a crease tone', () => {
    expect(theme.cardEdge).toBe(PAPER.washiDark);
    expect(theme.cardBorder).toBe(CREASE.light);
  });

  it('gives untyped nodes (BASE, tronc panel) the neutral paper tones', () => {
    expect(theme.neutralNode).toEqual(NODE_TYPE_NEUTRAL);
  });

  it('is the light theme unless asked otherwise', () => {
    expect(theme.mode).toBe('light');
    expect(buildCanvasTheme('light')).toEqual(theme);
  });

  it('cuts a tronc card from the same paper as the canvas', () => {
    expect(theme.card).toBe(PAPER.white);
  });

  it('lays a pin on a flat paper shadow and darkens its string toward ink', () => {
    expect(theme.pinShadow).toBe(PAPER.washiDark);
    expect(theme.thread).toBe(INK.dark);
  });

  it('returns only hex colors, which Konva and rough.js both parse', () => {
    const values = Object.entries(theme).filter(([k]) => k !== 'mode').flatMap(([, v]) => (typeof v === 'string' ? [v] : Object.values(v)));
    for (const value of values) expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('buildCanvasTheme dark', () => {
  // The D2 option of the Dark Pinya Canvas preview.
  const theme = buildCanvasTheme('dark');
  const l = (hex: string) => hexToOklch(hex).l;
  const canvasL = l(INK.dark);

  it('draws on the dark card colour, with the grid a step lighter', () => {
    expect(theme.mode).toBe('dark');
    expect(theme.paper).toBe(INK.dark);
    expect(l(theme.crease)).toBeCloseTo(canvasL + 0.1, 2);
  });

  it('writes in paper white, with faint inks for secondary text', () => {
    expect(theme.ink).toBe(PAPER.white);
    expect(theme.inkMuted).toBe(INK.faint);
    expect(theme.inkFaint).toBe(INK.light);
    expect(theme.onInk).toBe(INK.black);
  });

  it('marks the node being acted on in paper white', () => {
    expect(theme.focus).toBe(PAPER.white);
  });

  it('lifts the conflict red so it does not sink into the dark canvas', () => {
    const danger = hexToOklch(theme.danger);
    expect(danger.l).toBeCloseTo(0.68, 2);
    expect(danger.h).toBeCloseTo(hexToOklch(SEMANTIC.error).h, 0);
  });

  it('draws the dark marks on a node in faint ink', () => {
    expect(theme.nodeOutline).toBe(INK.faint);
  });

  it('puts observations on a sticker a step above the canvas, its edge a step further', () => {
    expect(l(theme.sticker)).toBeCloseTo(canvasL + 0.12, 2);
    expect(l(theme.stickerEdge)).toBeCloseTo(canvasL + 0.25, 2);
  });

  it('lifts a tronc card a step above the canvas, on an edge a step below it', () => {
    expect(l(theme.card)).toBeCloseTo(canvasL + 0.07, 2);
    expect(l(theme.cardEdge)).toBeCloseTo(canvasL - 0.07, 2);
    expect(l(theme.cardBorder)).toBeCloseTo(canvasL + 0.16, 2);
  });

  it('lays a pin on a shadow below the canvas and lightens its string toward paper', () => {
    expect(l(theme.pinShadow)).toBeCloseTo(canvasL - 0.08, 2);
    expect(theme.thread).toBe(PAPER.white);
  });

  it('gives untyped nodes the dark neutral tones', () => {
    expect(theme.neutralNode).toEqual(NODE_TYPE_NEUTRAL_DARK);
  });

  it('returns only hex colors', () => {
    const values = Object.entries(theme).filter(([k]) => k !== 'mode').flatMap(([, v]) => (typeof v === 'string' ? [v] : Object.values(v)));
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
