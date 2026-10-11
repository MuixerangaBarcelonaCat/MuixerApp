import { formatHex, hexToOklch } from './color';
import { CREASE, PAPER } from './fixed-colors';

/**
 * The two tones every figure node type is drawn with: a light `wash` for fills and a stronger
 * `pencil` for outlines and hatching.
 */
export interface NodeTones {
  wash: string;
  pencil: string;
}

// Where each position type takes its hue from: the preset color each one had before the canvas
// moved to the paper look, so a type keeps the color people already know. Only the hue carries
// over; lightness and chroma come from the levels below. Keys are the `positionType` vocabulary of
// `@muixer/shared`'s node presets.
const HUE_SOURCES: Record<string, string> = {
  // Agulla's own teal sat 22° from the laterals' cyan; it takes quinta's purple instead.
  agulla: '#8E24AA',
  mans: '#FFE082',
  laterals: '#80DEEA',
  vents: '#A5D6A7',
  'cordo-obert': '#FFF9C4',
  tap: '#be185d',
  crossa: '#9FA8DA',
  contrafort: '#EF9A9A',
  comodin: '#B0BEC5',
  segona: '#1E88E5',
  terça: '#43A047',
  quarta: '#FB8C00',
  quinta: '#8E24AA',
  sisena: '#546E7A',
  puntal: '#795548',
  alçadora: '#00ACC1',
  xiqueta: '#E53935',
  'direccio-tronc': '#d97706',
  'direccio-xicalla': '#db2777',
  'direccio-pinya': '#065f46',
};

const WASH = { l: 0.88, c: 0.065 };
const PENCIL = { l: 0.49, c: 0.12 };
// A yellow at the shared levels reads as beige and olive-brown: yellows only look yellow when light.
// Lifting them costs the pencil some contrast on paper (about 3:1 instead of 5.6:1). Cordó obert
// gets its own lemon, lighter and cooler than mans, so the two yellows stay apart.
const OVERRIDES: Record<string, { wash: { l: number; c: number }; pencil: { l: number; c: number }; h?: number }> = {
  mans: { wash: { l: 0.91, c: 0.1 }, pencil: { l: 0.58, c: 0.12 } },
  'cordo-obert': { wash: { l: 0.95, c: 0.1 }, pencil: { l: 0.64, c: 0.12 }, h: 104 },
};
// A source this gray (comodí, sisena) stays grayish: a full-chroma tone would invent a color the
// type never had.
const NEAR_GRAY_CHROMA = 0.045;
const NEAR_GRAY_CHROMA_SHARE = 0.35;

function tonesFor(positionType: string, sourceHex: string): NodeTones {
  const source = hexToOklch(sourceHex);
  const override = OVERRIDES[positionType];
  const h = override?.h ?? source.h;
  const share = source.c < NEAR_GRAY_CHROMA ? NEAR_GRAY_CHROMA_SHARE : 1;
  const { wash, pencil } = override ?? { wash: WASH, pencil: PENCIL };
  return {
    wash: formatHex({ l: wash.l, c: wash.c * share, h }),
    pencil: formatHex({ l: pencil.l, c: pencil.c * share, h }),
  };
}

/** Wash and pencil tones per position type, light mode. */
export const NODE_TYPE_PALETTE: Record<string, NodeTones> = Object.fromEntries(
  Object.entries(HUE_SOURCES).map(([positionType, hex]) => [positionType, tonesFor(positionType, hex)]),
);

/** Tones for nodes with no type color: the BASE nodes and the tronc panel's nodes. */
export const NODE_TYPE_NEUTRAL: NodeTones = { wash: PAPER.washiDark, pencil: CREASE.dark };
