import { FigureZone } from '../enums/figure-zone.enum';
import { NodeShape } from '../enums/node-shape.enum';

export interface TroncNodePreset {
  positionType: string;
  label: string;
  color: string;
  abbrev: string;
}

export const TRONC_NODE_PRESETS: TroncNodePreset[] = [
  { positionType: 'segona',   label: 'Segona',   color: '#1E88E5', abbrev: 'Seg' },
  { positionType: 'terça',    label: 'Terça',    color: '#43A047', abbrev: 'Ter' },
  { positionType: 'quarta',   label: 'Quarta',   color: '#FB8C00', abbrev: 'Qua' },
  { positionType: 'quinta',   label: 'Quinta',   color: '#8E24AA', abbrev: 'Qui' },
  { positionType: 'sisena',   label: 'Sisena',   color: '#546E7A', abbrev: 'Sis' },
  { positionType: 'puntal',   label: 'Puntal',   color: '#795548', abbrev: 'Pun' },
  { positionType: 'alçadora', label: 'Alçadora', color: '#00ACC1', abbrev: 'Alç' },
  { positionType: 'xiqueta',  label: 'Xiqueta',  color: '#E53935', abbrev: 'Xiq' },
];

/** Maps tronc z-level (1-based) to the conventional preset for that floor. */
export const TRONC_Z_DEFAULTS: Record<number, TroncNodePreset> = {
  1: TRONC_NODE_PRESETS.find((p) => p.positionType === 'segona')!,
  2: TRONC_NODE_PRESETS.find((p) => p.positionType === 'terça')!,
  3: TRONC_NODE_PRESETS.find((p) => p.positionType === 'quarta')!,
  4: TRONC_NODE_PRESETS.find((p) => p.positionType === 'quinta')!,
  5: TRONC_NODE_PRESETS.find((p) => p.positionType === 'xiqueta')!,
};

export interface NodePreset {
  zone: FigureZone;
  positionType: string | null;
  label: string;
  width: number;
  height: number;
  shape: NodeShape;
  color: string | null;
  requiresCustomLabel: boolean;
}

export const DIRECTION_NODE_PRESETS: NodePreset[] = [
  { zone: FigureZone.FIGURE_DIRECTION, positionType: 'direccio-figura', label: 'Direcció fig.', width: 90, height: 44, shape: NodeShape.RECTANGLE, color: '#d97706', requiresCustomLabel: false },
  { zone: FigureZone.XICALLA_DIRECTION, positionType: 'direccio-xicalla', label: 'Direcció xic.', width: 90, height: 44, shape: NodeShape.RECTANGLE, color: '#db2777', requiresCustomLabel: false },
];

export const DIRECTION_ZONES = DIRECTION_NODE_PRESETS.map((p) => p.zone);
export const DIRECTION_POSITION_TYPES = DIRECTION_NODE_PRESETS.map((p) => p.positionType as string);

export const DECORATION_NODE_PRESETS: NodePreset[] = [
  { zone: FigureZone.DECORATION, positionType: 'rectangle', label: '', width: 120, height: 80, shape: NodeShape.RECTANGLE, color: null, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'ellipse', label: '', width: 100, height: 60, shape: NodeShape.ELLIPSE, color: null, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'arrow', label: '', width: 80, height: 30, shape: NodeShape.ARROW, color: null, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'circle', label: '', width: 60, height: 60, shape: NodeShape.CIRCLE, color: null, requiresCustomLabel: true },
];

export const DECORATION_POSITION_TYPES = ['rectangle', 'ellipse', 'arrow', 'circle'] as const;
export type DecorationPositionType = (typeof DECORATION_POSITION_TYPES)[number];

export const PINYA_NODE_PRESETS: NodePreset[] = [
  { zone: FigureZone.PINYA, positionType: 'agulla',     label: 'AGULLA',     width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#0d9488', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'mans',       label: 'MANS',       width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#FFE082', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'laterals',   label: 'LATERAL',    width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#80DEEA', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'vents',      label: 'VENT',       width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#A5D6A7', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'cordo-obert',label: 'CORDÓ OBERT',width: 80, height: 40, shape: NodeShape.ELLIPSE,    color: '#FFF9C4', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'tap',        label: 'TAP',        width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#be185d', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'crossa',     label: 'CROSSA',     width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#9FA8DA', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'contrafort', label: 'CONTRAFORT', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#EF9A9A', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'comodin',    label: '...',        width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#B0BEC5', requiresCustomLabel: true  },
];

export const PINYA_POSITION_TYPES = PINYA_NODE_PRESETS.map((p) => p.positionType as string);
export type PinyaPositionType = string;

export const AD_HOC_ALLOWED_ZONES_PHASE1 = [FigureZone.PINYA] as const;

export const AD_HOC_ALLOWED_ZONES_PHASE2 = [
  ...AD_HOC_ALLOWED_ZONES_PHASE1,
  FigureZone.DECORATION,
] as const;

export const AD_HOC_ALLOWED_ZONES_PHASE3 = [
  ...AD_HOC_ALLOWED_ZONES_PHASE2,
  FigureZone.FIGURE_DIRECTION,
  FigureZone.XICALLA_DIRECTION,
] as const;

export const AD_HOC_ALLOWED_ZONES = AD_HOC_ALLOWED_ZONES_PHASE3;
