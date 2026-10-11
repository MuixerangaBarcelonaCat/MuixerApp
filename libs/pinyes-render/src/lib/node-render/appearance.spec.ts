import { SHOULDER_HEIGHT_BASELINE_CM } from '@muixer/shared';
import { FigureZone } from '@muixer/shared';
import { NODE_TYPE_NEUTRAL, NODE_TYPE_PALETTE } from '@muixer/ui';
import { buildCanvasTheme, fade } from '../theme/canvas-theme';
import { NodeAppearanceInput, formatShoulderHeight, resolveNodeAppearance } from './appearance';

const theme = buildCanvasTheme();
const vents = NODE_TYPE_PALETTE['vents'];

const empty: NodeAppearanceInput = {
  zone: FigureZone.PINYA,
  positionType: 'vents',
  color: null,
  label: 'Vent 1',
  mode: 'workspace',
};
const marta: NodeAppearanceInput = {
  ...empty,
  person: { name: 'Marta', height: '+4', nextActuacio: true, observation: { emoji: '🤕' } },
};

const appearance = (input: Partial<NodeAppearanceInput>) => resolveNodeAppearance({ ...marta, ...input }, theme);

describe('resolveNodeAppearance', () => {
  describe('an empty position', () => {
    it('is an outline in the pencil tone of its type, with no fill', () => {
      const a = resolveNodeAppearance(empty, theme);
      expect(a.fill).toEqual({ style: 'none' });
      expect(a.outline).toEqual({ color: vents.pencil, width: 1.3, dash: null });
    });

    it('shows the position label in uppercase, muted', () => {
      expect(resolveNodeAppearance(empty, theme).text).toEqual({
        kind: 'label',
        value: 'Vent 1',
        uppercase: true,
        typeface: 'sans',
        color: theme.inkMuted,
        halo: null,
        strike: false,
      });
    });

    it('has no badges', () => {
      const a = resolveNodeAppearance(empty, theme);
      expect([a.height, a.observation, a.star, a.conflictIcon, a.conflictLoop, a.moveBadge]).toEqual([
        null,
        null,
        false,
        false,
        false,
        false,
      ]);
    });
  });

  describe('attendance, in the fill', () => {
    it('confirmed: a solid wash outlined in the type pencil, like an empty node, the name in ink', () => {
      const a = appearance({ attendance: 'confirmed' });
      expect(a.fill).toEqual({ style: 'solid', color: vents.wash });
      expect(a.outline).toEqual({ color: vents.pencil, width: 1.3, dash: null });
      expect(a.outline).toEqual(resolveNodeAppearance(empty, theme).outline);
      expect(a.text).toEqual({ kind: 'name', value: 'Marta', uppercase: false, typeface: 'sans', color: theme.ink, halo: null, strike: false });
    });

    it('confirmed is the default when attendance is unknown', () => {
      expect(appearance({}).fill).toEqual({ style: 'solid', color: vents.wash });
    });

    it('confirmed on a dark custom color writes the name in paper', () => {
      expect(appearance({ color: '#1E3A8A' }).text.color).toBe(theme.paper);
    });

    it('pending: hatching in the pencil tone, outlined in pencil, the name on a paper halo', () => {
      const a = appearance({ attendance: 'pending' });
      expect(a.fill).toEqual({ style: 'hatch', color: vents.pencil });
      expect(a.outline).toEqual({ color: vents.pencil, width: 1.3, dash: null });
      expect(a.text.color).toBe(theme.ink);
      expect(a.text.halo).toBe(theme.paper);
    });

    it('absent: no fill, a faded outline and the name struck through in faint ink', () => {
      const a = appearance({ attendance: 'absent' });
      expect(a.fill).toEqual({ style: 'none' });
      expect(a.outline.color).toBe(fade(vents.pencil, 0.45, theme.paper));
      expect(a.text).toMatchObject({ kind: 'name', value: 'Marta', color: theme.inkFaint, strike: true });
    });
  });

  describe('tones', () => {
    it('draws BASE nodes in the neutral paper tones', () => {
      expect(appearance({ zone: FigureZone.BASE, positionType: 'base' }).fill).toEqual({
        style: 'solid',
        color: NODE_TYPE_NEUTRAL.wash,
      });
    });

    it('draws every node in the neutral tones when asked to (the tronc panel)', () => {
      const a = appearance({ palette: 'neutral', attendance: 'pending' });
      expect(a.fill).toEqual({ style: 'hatch', color: NODE_TYPE_NEUTRAL.pencil });
    });

    it('draws a customized node in its own color', () => {
      expect(appearance({ color: '#123456', attendance: 'pending' }).fill).toEqual({ style: 'hatch', color: '#123456' });
    });
  });

  describe('state marks', () => {
    it('selected: the outline turns ink and thicker, the fill keeps showing attendance', () => {
      const a = appearance({ selected: true, attendance: 'pending' });
      expect(a.outline).toEqual({ color: theme.focus, width: 3.2, dash: null });
      expect(a.fill).toEqual({ style: 'hatch', color: vents.pencil });
      expect(a.moveBadge).toBe(false);
    });

    it('move source: marked like selected, plus the move badge', () => {
      const a = appearance({ moveSource: true });
      expect(a.outline).toEqual({ color: theme.focus, width: 3.2, dash: null });
      expect(a.moveBadge).toBe(true);
    });

    it.each(['swap', 'move'] as const)('drop target (%s): a dashed ink outline, the fill untouched', (dropTarget) => {
      const a = appearance({ dropTarget });
      expect(a.outline).toEqual({ color: theme.focus, width: 2.4, dash: [5, 4] });
      expect(a.fill).toEqual({ style: 'solid', color: vents.wash });
    });

    it('a drop target can be an empty position', () => {
      const a = resolveNodeAppearance({ ...empty, dropTarget: 'move' }, theme);
      expect(a.outline).toEqual({ color: theme.focus, width: 2.4, dash: [5, 4] });
    });

    it('conflict: a red loop around the node and the conflict icon', () => {
      const a = appearance({ conflict: true });
      expect(a.conflictLoop).toBe(true);
      expect(a.conflictIcon).toBe(true);
      expect(a.outline.color).toBe(vents.pencil);
    });

    it('conflict in the projection: only the conflict icon, no loop around the node', () => {
      const a = appearance({ conflict: true, mode: 'projection' });
      expect(a.conflictLoop).toBe(false);
      expect(a.conflictIcon).toBe(true);
    });

    it('conflict and selected show both: ink outline inside, red loop outside', () => {
      const a = appearance({ conflict: true, selected: true });
      expect(a.outline.color).toBe(theme.focus);
      expect(a.conflictLoop).toBe(true);
    });

    it('an ad-hoc node is dashed, and keeps its dash when selected', () => {
      expect(appearance({ isAdHoc: true }).outline.dash).toEqual([6, 3]);
      expect(appearance({ isAdHoc: true, selected: true }).outline).toEqual({ color: theme.focus, width: 3.2, dash: [6, 3] });
    });
  });

  describe('name typeface', () => {
    it('writes names in Quicksand while staffing and editing', () => {
      expect(appearance({}).text.typeface).toBe('sans');
      expect(appearance({ mode: 'template', person: null }).text.typeface).toBe('sans');
    });

    it('writes names in Atkinson Hyperlegible in the projection, which is read from a distance', () => {
      expect(appearance({ mode: 'projection' }).text.typeface).toBe('legible');
    });

    it('keeps position labels in Quicksand in the projection', () => {
      expect(appearance({ mode: 'projection', person: null }).text.typeface).toBe('sans');
    });
  });

  describe('corner badges, by mode', () => {
    it('workspace: height top-left, observation top-right, star bottom-left', () => {
      const a = appearance({});
      expect(a.height).toBe('+4');
      expect(a.observation).toEqual({ emoji: '🤕' });
      expect(a.star).toBe(true);
    });

    it('projection: no height and no observation, the star stays', () => {
      const a = appearance({ mode: 'projection' });
      expect(a.height).toBeNull();
      expect(a.observation).toBeNull();
      expect(a.star).toBe(true);
    });

    it('shows no badge the person does not have', () => {
      const a = appearance({ person: { name: 'Marta' } });
      expect([a.height, a.observation, a.star]).toEqual([null, null, false]);
    });
  });

  describe('template mode (the template editor: no one is ever assigned)', () => {
    it('fills every node with its wash and outlines it in pencil, the label as typed in ink', () => {
      const a = resolveNodeAppearance({ ...empty, mode: 'template' }, theme);
      expect(a.fill).toEqual({ style: 'solid', color: vents.wash });
      expect(a.outline).toEqual({ color: vents.pencil, width: 1.3, dash: null });
      expect(a.text).toEqual({ kind: 'label', value: 'Vent 1', uppercase: false, typeface: 'sans', color: theme.ink, halo: null, strike: false });
    });
  });

  describe('decorations', () => {
    const decoration: NodeAppearanceInput = { ...empty, zone: FigureZone.DECORATION, positionType: 'circle', label: 'Bandera' };

    it('an uncolored decoration is a faint outline with its text as typed', () => {
      const a = resolveNodeAppearance(decoration, theme);
      expect(a.fill).toEqual({ style: 'none' });
      expect(a.outline).toEqual({ color: theme.inkFaint, width: 2, dash: null });
      expect(a.text).toEqual({ kind: 'caption', value: 'Bandera', uppercase: false, typeface: 'sans', color: theme.ink, halo: null, strike: false });
    });

    it('writes its text in Atkinson in the projection, and in Quicksand while staffing and editing', () => {
      expect(resolveNodeAppearance({ ...decoration, mode: 'projection' }, theme).text.typeface).toBe('legible');
      expect(resolveNodeAppearance({ ...decoration, mode: 'workspace' }, theme).text.typeface).toBe('sans');
      expect(resolveNodeAppearance({ ...decoration, mode: 'template' }, theme).text.typeface).toBe('sans');
    });

    it('a colored decoration is filled with its color', () => {
      expect(resolveNodeAppearance({ ...decoration, color: '#1E3A8A' }, theme)).toMatchObject({
        fill: { style: 'solid', color: '#1E3A8A' },
        text: { color: theme.paper },
      });
    });
  });
});

describe('formatShoulderHeight', () => {
  it('shows the height in cm in absolute mode', () => {
    expect(formatShoulderHeight(148, 'absolute')).toBe('148');
  });

  it('shows the signed difference from the baseline in relative mode', () => {
    expect(formatShoulderHeight(SHOULDER_HEIGHT_BASELINE_CM + 4, 'relative')).toBe('+4');
    expect(formatShoulderHeight(SHOULDER_HEIGHT_BASELINE_CM - 3, 'relative')).toBe('-3');
    expect(formatShoulderHeight(SHOULDER_HEIGHT_BASELINE_CM, 'relative')).toBe('+0');
  });

  it('shows nothing for an unknown height', () => {
    expect(formatShoulderHeight(null, 'relative')).toBeNull();
    expect(formatShoulderHeight(0, 'absolute')).toBeNull();
  });
});
