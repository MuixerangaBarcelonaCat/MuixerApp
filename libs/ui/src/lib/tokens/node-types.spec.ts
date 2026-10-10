import { hexToOklch } from './color';
import { CREASE, PAPER } from './fixed-colors';
import { NODE_TYPE_NEUTRAL, NODE_TYPE_PALETTE } from './node-types';

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
