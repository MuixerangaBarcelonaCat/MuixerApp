import { FigureZone } from '../enums/figure-zone.enum';

export const PINYA_POSITION_TYPES = [
  'agulla',
  'mans',
  'laterals',
  'vents',
  'cordo-obert',
  'tap',
  'crossa',
  'contrafort',
  'comodin',
] as const;

export type PinyaPositionType = (typeof PINYA_POSITION_TYPES)[number];

export const AD_HOC_ALLOWED_ZONES_PHASE1 = [FigureZone.PINYA] as const;

export const AD_HOC_ALLOWED_ZONES = [
  FigureZone.PINYA,
  FigureZone.DECORATION,
  FigureZone.FIGURE_DIRECTION,
  FigureZone.XICALLA_DIRECTION,
] as const;

export const DECORATION_POSITION_TYPES = [
  'rectangle',
  'arrow',
  'circle',
] as const;

export type DecorationPositionType = (typeof DECORATION_POSITION_TYPES)[number];

export const AD_HOC_ALLOWED_ZONES_PHASE2 = [
  FigureZone.PINYA,
  FigureZone.DECORATION,
] as const;

export const AD_HOC_ALLOWED_ZONES_PHASE3 = [
  FigureZone.PINYA,
  FigureZone.DECORATION,
  FigureZone.FIGURE_DIRECTION,
  FigureZone.XICALLA_DIRECTION,
] as const;

export const DIRECTION_ZONES = [
  FigureZone.FIGURE_DIRECTION,
  FigureZone.XICALLA_DIRECTION,
] as const;

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
