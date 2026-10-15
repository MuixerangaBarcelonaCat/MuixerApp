import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FONT_FAMILY, ThemeService } from '@muixer/ui';
import { FigureZone } from '@muixer/shared';
import { buildCanvasTheme } from '../../theme/canvas-theme';
import { NodeAppearanceInput, resolveNodeAppearance } from '../../node-render/appearance';
import { CANVAS_FONTS_LOADED } from '../../node-render/fonts';
import { NODE_NAME_MEASURE, NodeDrawingComponent } from './node-drawing.component';

const theme = buildCanvasTheme();
const SVG_NS = 'http://www.w3.org/2000/svg';

const marta: NodeAppearanceInput = {
  zone: FigureZone.TRONC,
  positionType: 'segona',
  color: null,
  label: 'Segona',
  palette: 'neutral',
  mode: 'workspace',
  person: { name: 'Marta', height: '+4', nextActuacio: true, observation: { emoji: '🤕' } },
};

/** Captures the component's ResizeObserver so a test can report a size. */
let reportSize: (width: number, height: number) => void = () => undefined;
class FakeResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {
    reportSize = (width, height) =>
      this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  observe(): void {
    /* sizes come from reportSize */
  }
  disconnect(): void {
    /* nothing to release */
  }
}

describe('NodeDrawingComponent', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = FakeResizeObserver;
    TestBed.configureTestingModule({
      providers: [{ provide: NODE_NAME_MEASURE, useValue: (text: string, fontSize: number) => text.length * fontSize * 0.6 }],
    });
  });

  afterEach(() => {
    (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = originalResizeObserver;
  });

  function render(input: Partial<NodeAppearanceInput> = {}, size: [number, number] | null = [80, 48]) {
    const fixture = TestBed.createComponent(NodeDrawingComponent);
    fixture.componentRef.setInput('appearance', resolveNodeAppearance({ ...marta, ...input }, theme));
    fixture.detectChanges();
    if (size) {
      reportSize(...size);
      fixture.detectChanges();
    }
    const svg = fixture.nativeElement.querySelector('svg[data-layer="node"]') as SVGSVGElement | null;
    const raised = fixture.nativeElement.querySelector('svg[data-layer="raised"]') as SVGSVGElement | null;
    return { fixture, svg, raised, el: fixture.nativeElement as HTMLElement };
  }

  it('draws nothing until it knows its size', () => {
    const { svg } = render({}, null);
    expect(svg).toBeNull();
  });

  it('draws an SVG the size of the cell, centred on the node, decorative for screen readers', () => {
    const { svg } = render();
    expect(svg?.namespaceURI).toBe(SVG_NS);
    expect(svg?.getAttribute('viewBox')).toBe('-40 -24 80 48');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    // The conflict loop and the sticker reach outside the cell.
    expect(svg?.getAttribute('overflow')).toBe('visible');
  });

  it('draws a confirmed node as a pen-drawn solid wash under the pencil outline', () => {
    const { svg } = render({ attendance: 'confirmed' });
    const fill = svg?.querySelector('path[data-role="fill"]');
    const outline = svg?.querySelector('path[data-role="outline"]');
    expect(fill?.getAttribute('fill')).toBe(theme.neutralNode.wash);
    expect(fill?.getAttribute('stroke')).toBe('none');
    expect(outline?.getAttribute('stroke')).toBe(theme.neutralNode.pencil);
    expect(outline?.getAttribute('fill')).toBe('none');
    expect(outline?.getAttribute('d')).toMatch(/C/);
    // The wash first, the outline over it.
    expect(fill?.compareDocumentPosition(outline as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(svg?.querySelector('rect')).toBeNull();
  });

  it('hatches a pending node with pen lines in the pencil tone', () => {
    const { svg } = render({ attendance: 'pending' });
    const hatch = svg?.querySelector('path[data-role="fill"]');
    expect(hatch?.getAttribute('stroke')).toBe(theme.neutralNode.pencil);
    expect(hatch?.getAttribute('fill')).toBe('none');
    expect(svg?.querySelector('pattern')).toBeNull();
  });

  it('dashes the outline of an ad-hoc node', () => {
    const outline = render({ isAdHoc: true }).svg?.querySelector('path[data-role="outline"]');
    expect(outline?.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('draws the same strokes for the same sketch key, other strokes for another key', () => {
    const outlineFor = (key: string) => {
      const fixture = TestBed.createComponent(NodeDrawingComponent);
      fixture.componentRef.setInput('appearance', resolveNodeAppearance(marta, theme));
      fixture.componentRef.setInput('sketchKey', key);
      fixture.detectChanges();
      reportSize(80, 48);
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('path[data-role="outline"]')?.getAttribute('d');
    };
    expect(outlineFor('node-a')).toBe(outlineFor('node-a'));
    expect(outlineFor('node-a')).not.toBe(outlineFor('node-b'));
  });

  it('draws the name in the typeface of the mode: Quicksand while staffing, Atkinson in the projection', () => {
    const font = (mode: 'workspace' | 'projection') =>
      render({ mode }).svg?.querySelector('text[data-role="name"]')?.getAttribute('font-family');
    expect(font('workspace')).toBe(FONT_FAMILY.sans.join(', '));
    expect(font('projection')).toBe(FONT_FAMILY.legible.join(', '));
  });

  it('draws the name centred, with its halo painted under the letters', () => {
    const name = render({ attendance: 'pending' }).svg?.querySelector('text[data-role="name"]');
    expect(name?.textContent).toBe('Marta');
    expect(name?.getAttribute('text-anchor')).toBe('middle');
    expect(name?.getAttribute('stroke')).toBe(theme.paper);
    expect(name?.getAttribute('paint-order')).toBe('stroke');
  });

  it('strikes an absent name through', () => {
    expect(render({ attendance: 'absent' }).svg?.querySelector('line[data-role="strike"]')).not.toBeNull();
  });

  it('writes an empty position label in caps, wrapping inside the node', () => {
    const { svg } = render({ person: null });
    const box = svg?.querySelector('foreignObject[data-role="label"]');
    expect(box?.getAttribute('width')).toBe('72');
    const div = box?.firstElementChild as HTMLElement;
    expect(div.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    expect(div.textContent?.trim()).toBe('SEGONA');
  });

  it('puts the height top-left', () => {
    const height = render().svg?.querySelector('text[data-role="height"]');
    expect(height?.textContent).toBe('+4');
    expect(height?.getAttribute('text-anchor')).toBe('start');
  });

  it('draws the star and the conflict icon as Lucide paths, with the conflict loop around the node', () => {
    const { svg, raised } = render({ conflict: true });
    expect(svg?.querySelector('g[data-icon="star"] path')?.getAttribute('fill')).toBe(theme.nodeOutline);
    expect(svg?.querySelector('g[data-icon="conflict"] path')?.getAttribute('stroke')).toBe(theme.danger);
    expect(raised?.querySelector('path[data-role="loop"]')?.getAttribute('stroke')).toBe(theme.danger);
  });

  it('sets the observation emoji on a pen-drawn paper sticker', () => {
    const { raised } = render();
    expect(raised?.querySelector('path[data-role="sticker"][fill]:not([fill="none"])')?.getAttribute('fill')).toBe(theme.sticker);
    expect(raised?.querySelector('path[data-role="sticker"][fill="none"]')?.getAttribute('stroke')).toBe(theme.stickerEdge);
    expect(raised?.querySelector('text[data-role="emoji"]')?.textContent).toBe('🤕');
  });

  it('draws its marks in the dark theme when the app is dark', () => {
    TestBed.inject(ThemeService).setPreference('dark');
    const dark = buildCanvasTheme('dark');
    const { svg, raised } = render({ conflict: true });
    expect(svg?.querySelector('g[data-icon="star"] path')?.getAttribute('fill')).toBe(dark.nodeOutline);
    expect(raised?.querySelector('path[data-role="loop"]')?.getAttribute('stroke')).toBe(dark.danger);
    expect(raised?.querySelector('path[data-role="sticker"]')?.getAttribute('fill')).toBe(dark.sticker);
    TestBed.inject(ThemeService).setPreference('system');
    localStorage.clear();
  });

  it('draws what reaches past the cell (the conflict loop, the sticker) on a layer above every other cell', () => {
    const { svg, raised } = render({ conflict: true });
    expect(svg?.querySelector('[data-role="loop"], [data-role="sticker"], text[data-role="emoji"]')).toBeNull();
    expect(raised?.getAttribute('viewBox')).toBe(svg?.getAttribute('viewBox'));
    expect(raised?.getAttribute('overflow')).toBe('visible');
    // Positioned with a z-index while the cell itself sets none: it stacks above every cell's body.
    expect(raised?.style.position).toBe('absolute');
    expect(raised?.style.zIndex).toBe('1');
  });

  it('draws no raised layer when nothing reaches past the cell', () => {
    expect(render({ person: { name: 'Marta' } }).raised).toBeNull();
  });

  it('measures the name again once the canvas faces have loaded', () => {
    const fontsLoaded = signal(false);
    const measure = jest.fn((text: string, fontSize: number) => text.length * fontSize * 0.6);
    TestBed.overrideProvider(NODE_NAME_MEASURE, { useValue: measure });
    TestBed.overrideProvider(CANVAS_FONTS_LOADED, { useValue: fontsLoaded });
    const { fixture } = render();
    const before = measure.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    fontsLoaded.set(true);
    fixture.detectChanges();

    expect(measure.mock.calls.length).toBeGreaterThan(before);
  });

  it('redraws when the cell changes size', () => {
    const { fixture } = render();
    reportSize(120, 40);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg').getAttribute('viewBox')).toBe('-60 -20 120 40');
  });
});
