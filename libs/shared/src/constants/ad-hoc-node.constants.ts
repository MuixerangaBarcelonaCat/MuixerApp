import { FigureZone } from '../enums/figure-zone.enum';
import { NodeShape } from '../enums/node-shape.enum';

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

export interface AdHocNodePreset {
  zone: FigureZone;
  positionType: string | null;
  label: string;
  width: number;
  height: number;
  shape: NodeShape;
  color: string;
  requiresCustomLabel: boolean;
}

export const AD_HOC_PINYA_PRESETS: AdHocNodePreset[] = [
  { zone: FigureZone.PINYA, positionType: 'agulla', label: 'Agulla', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#0d9488', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'mans', label: 'Mans', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#FFE082', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'laterals', label: 'Laterals', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#80DEEA', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'vents', label: 'Vents', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#A5D6A7', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'cordo-obert', label: 'Cordó obert', width: 80, height: 40, shape: NodeShape.ELLIPSE, color: '#FFF9C4', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'tap', label: 'Tap', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#be185d', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'crossa', label: 'Crossa', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#9FA8DA', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'contrafort', label: 'Contrafort', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#EF9A9A', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'comodin', label: '', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#B0BEC5', requiresCustomLabel: true },
];
