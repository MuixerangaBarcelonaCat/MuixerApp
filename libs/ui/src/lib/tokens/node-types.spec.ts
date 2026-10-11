import { hexToOklch } from './color';
import { CREASE, INK, PAPER } from './fixed-colors';
import { NODE_TYPE_NEUTRAL, NODE_TYPE_NEUTRAL_DARK, NODE_TYPE_PALETTE, NODE_TYPE_PALETTE_DARK } from './node-types';

describe('NODE_TYPE_PALETTE', () => {
  // The values the user picked on the Pinya Canvas Options preview (palette «between B and C»):
  // today's preset hues at wash L 0.88 / C 0.065 and pencil L 0.49 / C 0.12, with the yellows lifted
  // to the «Brighter yellow» option of the Mans Yellow Options preview and cordó obert to the
  // «Bright lemon» option of the Cordó Obert Lemon preview. Pinned here so a change to
  // the levels or the hue sources shows up as a diff against what was approved.
  const APPROVED: Record<string, { wash: string; pencil: string }> = {
    agulla: { wash: '#eacbf4', pencil: '#7c488c' },
    mans: { wash: '#f9e093', pencil: '#947700' },
    laterals: { wash: '#a5e4ed', pencil: '#006d78' },
    vents: { wash: '#bde4be', pencil: '#297233' },
    'cordo-obert': { wash: '#f9f2a3', pencil: '#998f29' },
    tap: { wash: '#fec6d2', pencil: '#963f59' },
    crossa: { wash: '#cdd5ff', pencil: '#5058a3' },
    contrafort: { wash: '#ffc7c6', pencil: '#993f44' },
    comodin: { wash: '#c9dbe4', pencil: '#476574' },
    segona: { wash: '#badbff', pencil: '#2163a1' },
    terça: { wash: '#bee3bd', pencil: '#2d7130' },
    quarta: { wash: '#f9cead', pencil: '#8f4d00' },
    quinta: { wash: '#eacbf4', pencil: '#7c488c' },
    sisena: { wash: '#c9dbe3', pencil: '#476573' },
    puntal: { wash: '#fecab7', pencil: '#974424' },
    alçadora: { wash: '#a5e4ef', pencil: '#006d7b' },
    xiqueta: { wash: '#ffc8c1', pencil: '#994139' },
    'direccio-tronc': { wash: '#f9ceae', pencil: '#904c00' },
    'direccio-xicalla': { wash: '#fdc6d5', pencil: '#953f5d' },
    'direccio-pinya': { wash: '#afe6ce', pencil: '#007254' },
  };

  it('has exactly the approved wash and pencil tones for every position type', () => {
    expect(NODE_TYPE_PALETTE).toEqual(APPROVED);
  });

  it('puts every wash at L 0.88 and every pencil at L 0.49, except the yellows', () => {
    const others = Object.entries(NODE_TYPE_PALETTE).filter(([type]) => !['mans', 'cordo-obert'].includes(type));
    for (const [, { wash, pencil }] of others) {
      expect(hexToOklch(wash).l).toBeCloseTo(0.88, 2);
      expect(hexToOklch(pencil).l).toBeCloseTo(0.49, 2);
    }
  });

  it('lifts mans to wash L 0.91 / C 0.10 and pencil L 0.58: at the shared levels a yellow reads as brown', () => {
    const { wash, pencil } = NODE_TYPE_PALETTE['mans'];
    expect(hexToOklch(wash).l).toBeCloseTo(0.91, 2);
    expect(hexToOklch(wash).c).toBeCloseTo(0.1, 2);
    expect(hexToOklch(pencil).l).toBeCloseTo(0.58, 2);
  });

  it('gives cordó obert its own lemon, lighter and cooler than mans', () => {
    const lemon = hexToOklch(NODE_TYPE_PALETTE['cordo-obert'].wash);
    const mans = hexToOklch(NODE_TYPE_PALETTE['mans'].wash);
    expect(lemon.l).toBeCloseTo(0.95, 2);
    expect(lemon.l).toBeGreaterThan(mans.l);
    expect(lemon.h).toBeGreaterThan(mans.h + 8);
    expect(hexToOklch(NODE_TYPE_PALETTE['cordo-obert'].pencil).l).toBeCloseTo(0.64, 2);
  });

  it('gives agulla the purple of quinta instead of a teal next to the laterals', () => {
    expect(NODE_TYPE_PALETTE['agulla']).toEqual(NODE_TYPE_PALETTE['quinta']);
  });

  it('keeps near-gray types (comodí, sisena) near gray: about a third of the chroma of the others', () => {
    const chroma = (hex: string) => hexToOklch(hex).c;
    expect(chroma(NODE_TYPE_PALETTE['comodin'].pencil)).toBeLessThan(chroma(NODE_TYPE_PALETTE['vents'].pencil) * 0.4);
    expect(chroma(NODE_TYPE_PALETTE['sisena'].wash)).toBeLessThan(chroma(NODE_TYPE_PALETTE['vents'].wash) * 0.4);
  });

  it('has a neutral paper tone for nodes with no type color: the BASE and the tronc panel', () => {
    expect(NODE_TYPE_NEUTRAL).toEqual({ wash: PAPER.washiDark, pencil: CREASE.dark });
  });
});

describe('NODE_TYPE_PALETTE_DARK', () => {
  // The values the user picked on the Dark Pinya Canvas preview (D2): the light levels inverted, a
  // dark wash at L 0.37 / C 0.055 and a light pencil at L 0.78 / C 0.10, each type on its light hue.
  // A few differ from the preview by one hex step: the preview read each hue back from the light
  // pencil, after gamut mapping, instead of from the hue source.
  const APPROVED: Record<string, { wash: string; pencil: string }> = {
    agulla: { wash: '#4c3653', pencil: '#d2a3e1' },
    mans: { wash: '#5b4b18', pencil: '#dfc679' },
    laterals: { wash: '#12484e', pencil: '#5ecad7' },
    vents: { wash: '#2c482e', pencil: '#8dc991' },
    'cordo-obert': { wash: '#5c5724', pencil: '#dcd586' },
    tap: { wash: '#58333c', pencil: '#ee9cb0' },
    crossa: { wash: '#383d5d', pencil: '#a6b2f7' },
    contrafort: { wash: '#593334', pencil: '#f19d9d' },
    comodin: { wash: '#354248', pencil: '#a1bcca' },
    segona: { wash: '#29425c', pencil: '#86bcf6' },
    terça: { wash: '#2d472d', pencil: '#90c88f' },
    quarta: { wash: '#553821', pencil: '#e7a875' },
    quinta: { wash: '#4c3653', pencil: '#d2a3e1' },
    sisena: { wash: '#354248', pencil: '#a1bcc9' },
    puntal: { wash: '#593529', pencil: '#efa286' },
    alçadora: { wash: '#134850', pencil: '#60c9db' },
    xiqueta: { wash: '#593430', pencil: '#f19f95' },
    'direccio-tronc': { wash: '#553821', pencil: '#e8a876' },
    'direccio-xicalla': { wash: '#58333e', pencil: '#ed9cb4' },
    'direccio-pinya': { wash: '#1f4939', pencil: '#73ccaa' },
  };

  it('has exactly the approved wash and pencil tones for every position type', () => {
    expect(NODE_TYPE_PALETTE_DARK).toEqual(APPROVED);
  });

  it('inverts the light levels: a dark wash at L 0.37 and a light pencil at L 0.78, except the yellows', () => {
    const others = Object.entries(NODE_TYPE_PALETTE_DARK).filter(([type]) => !['mans', 'cordo-obert'].includes(type));
    for (const [, { wash, pencil }] of others) {
      expect(hexToOklch(wash).l).toBeCloseTo(0.37, 2);
      expect(hexToOklch(pencil).l).toBeCloseTo(0.78, 2);
    }
  });

  it('keeps every type on its light-mode hue', () => {
    for (const [type, { pencil }] of Object.entries(NODE_TYPE_PALETTE_DARK)) {
      if (['comodin', 'sisena'].includes(type)) continue;
      expect(Math.abs(hexToOklch(pencil).h - hexToOklch(NODE_TYPE_PALETTE[type].pencil).h)).toBeLessThan(3);
    }
  });

  it('lifts the yellows, cordó obert above mans, so they stay apart', () => {
    const mans = NODE_TYPE_PALETTE_DARK['mans'];
    const lemon = NODE_TYPE_PALETTE_DARK['cordo-obert'];
    expect(hexToOklch(mans.wash).l).toBeCloseTo(0.42, 2);
    expect(hexToOklch(lemon.wash).l).toBeCloseTo(0.45, 2);
    expect(hexToOklch(lemon.pencil).l).toBeGreaterThan(hexToOklch(mans.pencil).l);
  });

  it('has a neutral tone a step above the dark card for the BASE and the tronc panel, outlined in faint ink', () => {
    expect(NODE_TYPE_NEUTRAL_DARK.wash).toBe('#565550');
    expect(hexToOklch(NODE_TYPE_NEUTRAL_DARK.wash).h).toBeCloseTo(hexToOklch(INK.dark).h, 0);
    expect(NODE_TYPE_NEUTRAL_DARK.pencil).toBe(INK.faint);
  });
});
