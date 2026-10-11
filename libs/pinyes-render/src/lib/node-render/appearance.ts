import { FigureZone, SHOULDER_HEIGHT_BASELINE_CM } from '@muixer/shared';
import { HeightMode } from '../models/assignment.model';
import { CanvasTheme, contentOn, fade } from '../theme/canvas-theme';
import { resolveNodeTones } from '../theme/node-color';
import { AttendanceFill } from './attendance';

/**
 * Where a node is drawn. `workspace` is the segment workspace (every badge); `projection` leaves
 * out the badges that only matter while staffing (height, observation); `template` is the
 * template editor, where no one is ever assigned and every node shows its type.
 */
export type NodeAppearanceMode = 'workspace' | 'projection' | 'template';

export interface NodeAppearanceInput {
  zone: string;
  positionType: string | null;
  /** Stored color: `null` follows the type palette. */
  color: string | null;
  isAdHoc?: boolean;
  /** Position label, climb indicator included: shown while no one is assigned. */
  label: string;
  person?: {
    /** Alias, climb indicator included. */
    name: string;
    /** Shoulder height, already formatted for the height mode. */
    height?: string | null;
    nextActuacio?: boolean;
    observation?: { emoji: string | null } | null;
  } | null;
  attendance?: AttendanceFill;
  selected?: boolean;
  moveSource?: boolean;
  dropTarget?: 'swap' | 'move' | null;
  conflict?: boolean;
  /** `neutral` draws every node in the paper tones (the tronc panel). */
  palette?: 'type' | 'neutral';
  mode: NodeAppearanceMode;
}

export type NodeFill = { style: 'none' } | { style: 'solid'; color: string } | { style: 'hatch'; color: string };

export interface NodeAppearance {
  fill: NodeFill;
  outline: { color: string; width: number; dash: number[] | null };
  text: {
    /** A person's name, a position label, or the free text of a decoration. */
    kind: 'name' | 'label' | 'caption';
    value: string;
    uppercase: boolean;
    /**
     * `legible` (Atkinson Hyperlegible, fitted to the node) for names in the projection, read from
     * a distance; `sans` (Quicksand, one size) everywhere else.
     */
    typeface: 'legible' | 'sans';
    color: string;
    /** A paper ring around the letters, so hatching never crosses them. */
    halo: string | null;
    strike: boolean;
  };
  /** Top-left. */
  height: string | null;
  /** Top-right, on a paper sticker; a null emoji draws the observation icon. */
  observation: { emoji: string | null } | null;
  /** Bottom-left: comes to the next actuació. */
  star: boolean;
  /** Bottom-right. */
  conflictIcon: boolean;
  /** Red pen loop around the node. */
  conflictLoop: boolean;
  /** On the top edge: this node's person is being moved. */
  moveBadge: boolean;
}

const OUTLINE_WIDTH = 1.3;
const DECORATION_OUTLINE_WIDTH = 2;
const ACTED_ON_WIDTH = 3.2;
const DROP_TARGET_WIDTH = 2.4;
const DROP_TARGET_DASH = [5, 4];
const AD_HOC_DASH = [6, 3];
/** How far an absent node's outline fades toward the paper. */
const ABSENT_FADE = 0.45;

/**
 * Everything a renderer needs to draw one node, from what the node is and what is happening to
 * it. One visual channel per kind of state: the fill shows attendance, the outline the type (or
 * ink while the node is acted on), a red loop a conflict. No state repaints another's channel.
 */
export function resolveNodeAppearance(input: NodeAppearanceInput, theme: CanvasTheme): NodeAppearance {
  const base = input.zone === FigureZone.DECORATION ? decorationAppearance(input, theme) : nodeAppearance(input, theme);
  return applyStateMarks(base, input, theme);
}

function nodeAppearance(input: NodeAppearanceInput, theme: CanvasTheme): NodeAppearance {
  const tones = input.palette === 'neutral' ? theme.neutralNode : resolveNodeTones(input);
  const person = input.person ?? null;
  const showsEditBadges = input.mode === 'workspace';

  const appearance: NodeAppearance = {
    fill: { style: 'none' },
    outline: { color: tones.pencil, width: OUTLINE_WIDTH, dash: null },
    text: { kind: 'label', value: input.label, uppercase: true, typeface: 'sans', color: theme.inkMuted, halo: null, strike: false },
    height: person && showsEditBadges ? (person.height ?? null) : null,
    observation: person && showsEditBadges ? (person.observation ?? null) : null,
    star: !!person?.nextActuacio,
    conflictIcon: false,
    conflictLoop: false,
    moveBadge: false,
  };

  if (input.mode === 'template') {
    appearance.fill = { style: 'solid', color: tones.wash };
    appearance.text = { ...appearance.text, uppercase: false, color: contentOn(tones.wash) };
    return appearance;
  }
  if (!person) return appearance;

  const name = {
    kind: 'name' as const,
    value: person.name,
    uppercase: false,
    typeface: input.mode === 'projection' ? ('legible' as const) : ('sans' as const),
    halo: null,
    strike: false,
  };
  switch (input.attendance ?? 'confirmed') {
    case 'confirmed':
      appearance.fill = { style: 'solid', color: tones.wash };
      appearance.text = { ...name, color: contentOn(tones.wash) };
      break;
    case 'pending':
      appearance.fill = { style: 'hatch', color: tones.pencil };
      appearance.text = { ...name, color: theme.ink, halo: theme.paper };
      break;
    case 'absent':
      appearance.outline.color = fade(tones.pencil, ABSENT_FADE, theme.paper);
      appearance.text = { ...name, color: theme.inkFaint, strike: true };
      break;
  }
  return appearance;
}

/** Decorations carry no one and no type: a faint outline, filled only when they have a color. */
function decorationAppearance(input: NodeAppearanceInput, theme: CanvasTheme): NodeAppearance {
  return {
    fill: input.color ? { style: 'solid', color: input.color } : { style: 'none' },
    outline: { color: theme.inkFaint, width: DECORATION_OUTLINE_WIDTH, dash: null },
    text: {
      kind: 'caption',
      value: input.label,
      uppercase: false,
      typeface: input.mode === 'projection' ? 'legible' : 'sans',
      color: input.color ? contentOn(input.color) : theme.ink,
      halo: null,
      strike: false,
    },
    height: null,
    observation: null,
    star: false,
    conflictIcon: false,
    conflictLoop: false,
    moveBadge: false,
  };
}

function applyStateMarks(appearance: NodeAppearance, input: NodeAppearanceInput, theme: CanvasTheme): NodeAppearance {
  const outline = { ...appearance.outline, dash: input.isAdHoc ? AD_HOC_DASH : appearance.outline.dash };
  if (input.selected || input.moveSource) {
    outline.color = theme.focus;
    outline.width = ACTED_ON_WIDTH;
  } else if (input.dropTarget) {
    outline.color = theme.focus;
    outline.width = DROP_TARGET_WIDTH;
    outline.dash = DROP_TARGET_DASH;
  }
  const conflict = !!input.conflict && !!input.person;
  return {
    ...appearance,
    outline,
    conflictIcon: conflict,
    // The loop is for whoever staffs the figure; in the projection the icon is enough.
    conflictLoop: conflict && input.mode !== 'projection',
    moveBadge: !!input.moveSource,
  };
}

/** A person's shoulder height as a node shows it: cm, or the signed difference from the baseline. Null when unknown. */
export function formatShoulderHeight(cm: number | null, mode: HeightMode): string | null {
  if (cm == null || cm === 0) return null;
  if (mode === 'absolute') return `${cm}`;
  const diff = cm - SHOULDER_HEIGHT_BASELINE_CM;
  return diff >= 0 ? `+${diff}` : `${diff}`;
}
