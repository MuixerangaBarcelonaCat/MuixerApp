import { FigureZone } from '../enums/figure-zone.enum';
import { NodeShape } from '../enums/node-shape.enum';

export interface TroncNodePreset {
  positionType: string;
  label: string;
  abbrev: string;
}

export const TRONC_NODE_PRESETS: TroncNodePreset[] = [
  { positionType: 'segona',   label: 'Segona',   abbrev: 'Seg' },
  { positionType: 'terça',    label: 'Terça',    abbrev: 'Ter' },
  { positionType: 'quarta',   label: 'Quarta',   abbrev: 'Qua' },
  { positionType: 'quinta',   label: 'Quinta',   abbrev: 'Qui' },
  { positionType: 'sisena',   label: 'Sisena',   abbrev: 'Sis' },
  { positionType: 'puntal',   label: 'Puntal',   abbrev: 'Pun' },
  { positionType: 'alçadora', label: 'Alçadora', abbrev: 'Alç' },
  { positionType: 'xiqueta',  label: 'Xiqueta',  abbrev: 'Xiq' },
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
  requiresCustomLabel: boolean;
}

/**
 * A direction preset. All direction nodes share `zone: FigureZone.DIRECTION`; the flavour is
 * `positionType` (`direccio-tronc` / `direccio-xicalla` / `direccio-pinya`). `shortLabel` is
 * the per-row caption in the tronc view's "Direccions" section; `slotOrder` fixes the order
 * those rows stack in, everywhere they are rendered. `projectionMarker` is the short letter
 * appended after a person's name on the projection's single direction line (e.g. «(X)»);
 * `null` leaves the name unmarked.
 */
export interface DirectionNodePreset extends NodePreset {
  zone: FigureZone.DIRECTION;
  positionType: string;
  shortLabel: string;
  slotOrder: number;
  projectionMarker: string | null;
}

export const DIRECTION_NODE_PRESETS: DirectionNodePreset[] = [
  { zone: FigureZone.DIRECTION, positionType: 'direccio-tronc',   label: 'Direcció tronc',   shortLabel: 'Tronc',   slotOrder: 0, projectionMarker: null, width: 90, height: 44, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
  { zone: FigureZone.DIRECTION, positionType: 'direccio-xicalla', label: 'Direcció xicalla', shortLabel: 'Xicalla', slotOrder: 1, projectionMarker: 'X',  width: 90, height: 44, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
  { zone: FigureZone.DIRECTION, positionType: 'direccio-pinya',   label: 'Direcció pinya',   shortLabel: 'Pinya',   slotOrder: 2, projectionMarker: 'P',  width: 90, height: 44, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
];

/** Direction presets in the fixed order their rows stack (by `slotOrder`). */
export const DIRECTION_SLOTS: DirectionNodePreset[] = [...DIRECTION_NODE_PRESETS].sort((a, b) => a.slotOrder - b.slotOrder);

/**
 * The «direcció pinya» flavour — a pinya director. Named because its conflict rule differs:
 * it does not conflict with a PINYA placement of the *same* figure instance
 * (`conflictRelevantPlacements` in `assignment-area.constants.ts`).
 */
export const DIRECCIO_PINYA_POSITION_TYPE = 'direccio-pinya';

export const DIRECTION_ZONES: FigureZone[] = [FigureZone.DIRECTION];
export const DIRECTION_POSITION_TYPES = DIRECTION_NODE_PRESETS.map((p) => p.positionType);

export const DECORATION_NODE_PRESETS: NodePreset[] = [
  { zone: FigureZone.DECORATION, positionType: 'rectangle', label: '', width: 120, height: 80, shape: NodeShape.RECTANGLE, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'ellipse', label: '', width: 100, height: 60, shape: NodeShape.ELLIPSE, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'triangle', label: '', width: 90, height: 80, shape: NodeShape.TRIANGLE, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'star', label: '', width: 70, height: 70, shape: NodeShape.STAR, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'circle', label: '', width: 60, height: 60, shape: NodeShape.CIRCLE, requiresCustomLabel: true },
  // Arrows grouped together, narrower (shorter head) than the other shapes above, except
  // up/down: those default wide-and-short (a broad head) rather than mirroring left/right's
  // tall-and-narrow proportions rotated 90°.
  { zone: FigureZone.DECORATION, positionType: 'arrow', label: '', width: 80, height: 20, shape: NodeShape.ARROW, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'arrow-left', label: '', width: 80, height: 20, shape: NodeShape.ARROW_LEFT, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'arrow-up', label: '', width: 80, height: 40, shape: NodeShape.ARROW_UP, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'arrow-down', label: '', width: 80, height: 40, shape: NodeShape.ARROW_DOWN, requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'double-arrow', label: '', width: 90, height: 20, shape: NodeShape.DOUBLE_ARROW, requiresCustomLabel: true },
];

export const DECORATION_POSITION_TYPES = ['rectangle', 'ellipse', 'triangle', 'star', 'circle', 'arrow', 'arrow-left', 'arrow-up', 'arrow-down', 'double-arrow'] as const;
export type DecorationPositionType = (typeof DECORATION_POSITION_TYPES)[number];

export const PINYA_NODE_PRESETS: NodePreset[] = [
  { zone: FigureZone.PINYA, positionType: 'agulla',     label: 'AGULLA',     width: 80, height: 40, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'mans',       label: 'MANS',       width: 80, height: 40, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'laterals',   label: 'LATERAL',    width: 80, height: 40, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'vents',      label: 'VENT',       width: 80, height: 40, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'cordo-obert',label: 'CORDÓ OBERT',width: 80, height: 40, shape: NodeShape.ELLIPSE,    requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'tap',        label: 'TAP',        width: 80, height: 40, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'crossa',     label: 'CROSSA',     width: 80, height: 40, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'contrafort', label: 'CONTRAFORT', width: 80, height: 40, shape: NodeShape.RECTANGLE, requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'comodin',    label: '...',        width: 80, height: 40, shape: NodeShape.RECTANGLE, requiresCustomLabel: true  },
];

export const PINYA_POSITION_TYPES = PINYA_NODE_PRESETS.map((p) => p.positionType as string);
export type PinyaPositionType = string;

/** Tipus de posició de la base del tronc. No és cap preset de node: és un valor solt del vocabulari. */
export const BASE_POSITION_TYPE = 'base';

export const AD_HOC_ALLOWED_ZONES = [
  FigureZone.PINYA,
  FigureZone.DECORATION,
  FigureZone.DIRECTION,
] as const;
