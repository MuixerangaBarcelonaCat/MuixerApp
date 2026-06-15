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
