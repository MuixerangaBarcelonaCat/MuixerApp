import { FigureZone } from '../enums/figure-zone.enum';
import { NodeShape } from '../enums/node-shape.enum';

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
  { zone: FigureZone.FIGURE_DIRECTION, positionType: null, label: 'Direcció fig.', width: 90, height: 44, shape: NodeShape.RECTANGLE, color: '#d97706', requiresCustomLabel: false },
  { zone: FigureZone.XICALLA_DIRECTION, positionType: null, label: 'Direcció xic.', width: 90, height: 44, shape: NodeShape.RECTANGLE, color: '#db2777', requiresCustomLabel: false },
];

export const DECORATION_NODE_PRESETS: NodePreset[] = [
  { zone: FigureZone.DECORATION, positionType: 'rectangle', label: '', width: 120, height: 80, shape: NodeShape.RECTANGLE, color: null, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'arrow', label: '', width: 80, height: 30, shape: NodeShape.ARROW, color: null, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'circle', label: '', width: 60, height: 60, shape: NodeShape.CIRCLE, color: null, requiresCustomLabel: true },
];

export const PINYA_NODE_PRESETS: NodePreset[] = [
  { zone: FigureZone.PINYA, positionType: 'agulla', label: 'AGULLA', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#0d9488', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'mans', label: 'MANS', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#FFE082', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'laterals', label: 'LATERAL', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#80DEEA', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'vents', label: 'VENT', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#A5D6A7', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'cordo-obert', label: 'CORDÓ OBERT', width: 80, height: 40, shape: NodeShape.ELLIPSE, color: '#FFF9C4', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'tap', label: 'TAP', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#be185d', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'crossa', label: 'CROSSA', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#9FA8DA', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'contrafort', label: 'CONTRAFORT', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#EF9A9A', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'comodin', label: '...', width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#B0BEC5', requiresCustomLabel: true },
];
