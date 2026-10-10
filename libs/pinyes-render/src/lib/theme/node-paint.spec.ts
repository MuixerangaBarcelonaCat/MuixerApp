import { FigureZone } from '@muixer/shared';
import { INK, NODE_TYPE_NEUTRAL, NODE_TYPE_PALETTE, PAPER } from '@muixer/ui';
import { buildCanvasTheme } from './canvas-theme';
import { attendanceDotColor, nodeFill, nodeLabelColor } from './node-paint';

const theme = buildCanvasTheme();

describe('nodeFill', () => {
  it('fills a typed node with the wash of its type', () => {
    expect(nodeFill({ zone: FigureZone.PINYA, positionType: 'mans', color: null })).toBe(NODE_TYPE_PALETTE['mans'].wash);
  });

  it('fills BASE nodes with the neutral wash', () => {
    expect(nodeFill({ zone: FigureZone.BASE, positionType: 'base', color: null })).toBe(NODE_TYPE_NEUTRAL.wash);
  });

  it('fills a customized node with its own color', () => {
    expect(nodeFill({ zone: FigureZone.PINYA, positionType: 'mans', color: '#123456' })).toBe('#123456');
  });

  it('leaves a decoration with no color unfilled, and fills one that has a color', () => {
    expect(nodeFill({ zone: FigureZone.DECORATION, positionType: 'circle', color: null })).toBe('transparent');
    expect(nodeFill({ zone: FigureZone.DECORATION, positionType: 'circle', color: '#123456' })).toBe('#123456');
  });
});

describe('nodeLabelColor', () => {
  it('writes in ink on a light wash and in paper on a dark custom color', () => {
    expect(nodeLabelColor({ zone: FigureZone.PINYA, positionType: 'mans', color: null })).toBe(INK.black);
    expect(nodeLabelColor({ zone: FigureZone.PINYA, positionType: 'mans', color: '#1E3A8A' })).toBe(PAPER.white);
  });

  it('writes in ink on an unfilled decoration', () => {
    expect(nodeLabelColor({ zone: FigureZone.DECORATION, positionType: 'circle', color: null })).toBe(INK.black);
  });
});

describe('attendanceDotColor', () => {
  it('before the arrival phase: going is success, pending is warning, not going is danger', () => {
    expect(attendanceDotColor('ANIRE', false, theme)).toBe(theme.success);
    expect(attendanceDotColor('PENDENT', false, theme)).toBe(theme.warning);
    expect(attendanceDotColor('NO_VAIG', false, theme)).toBe(theme.danger);
  });

  it('during arrival: said yes but not here is warning, still pending is danger', () => {
    expect(attendanceDotColor('ANIRE', true, theme)).toBe(theme.warning);
    expect(attendanceDotColor('PENDENT', true, theme)).toBe(theme.danger);
    expect(attendanceDotColor('NO_VAIG', true, theme)).toBe(theme.danger);
  });

  it('shows no dot for someone who is here, or with no known status', () => {
    expect(attendanceDotColor('ASSISTIT', true, theme)).toBeNull();
    expect(attendanceDotColor(undefined, false, theme)).toBeNull();
  });
});
