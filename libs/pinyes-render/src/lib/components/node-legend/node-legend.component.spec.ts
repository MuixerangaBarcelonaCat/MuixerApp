import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ButtonComponent, NODE_TYPE_NEUTRAL, NODE_TYPE_PALETTE, NODE_TYPE_PALETTE_DARK, ThemeService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { NODE_NAME_MEASURE, NodeDrawingComponent } from '../node-drawing/node-drawing.component';
import { NodeLegendComponent } from './node-legend.component';

describe('NodeLegendComponent', () => {
  function setup(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [NodeLegendComponent],
      providers: [allLucideIconsProvider, { provide: NODE_NAME_MEASURE, useValue: (t: string, fs: number) => t.length * fs * 0.6 }],
    });
    const fixture = TestBed.createComponent(NodeLegendComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    const button = () => fixture.debugElement.query(By.directive(ButtonComponent)).componentInstance as ButtonComponent;
    const panel = () => fixture.nativeElement.querySelector('[data-testid="node-legend"]') as HTMLElement | null;
    const toggle = () => {
      button().clicked.emit();
      fixture.detectChanges();
    };
    return { fixture, button, panel, toggle };
  }

  it('shows a «Llegenda» button, closed', () => {
    const { button, panel, fixture } = setup();
    expect(fixture.nativeElement.textContent).toContain('Llegenda');
    expect(button().ariaExpanded()).toBe(false);
    expect(panel()).toBeNull();
  });

  it('opens on click and closes on a second click', () => {
    const { button, panel, toggle } = setup();
    toggle();
    expect(button().ariaExpanded()).toBe(true);
    expect(panel()).not.toBeNull();
    toggle();
    expect(panel()).toBeNull();
  });

  it('closes with Escape', () => {
    const { panel, toggle, fixture } = setup();
    toggle();
    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('explains the attendance fills in the words of the phase, and the empty position', () => {
    const { panel, toggle } = setup({ phase: 'started' });
    toggle();
    const text = panel()!.textContent!;
    expect(text).toContain('Assistència');
    expect(text).toContain('Ha arribat');
    expect(text).toContain('No ha arribat');
    expect(text).toContain('Pendent o no vindrà');
    expect(text).toContain('Posició buida');
  });

  it('explains the marks', () => {
    const { panel, toggle } = setup();
    toggle();
    const text = panel()!.textContent!;
    expect(text).toContain('Marques');
    expect(text).toContain('Ve a la propera actuació');
    expect(text).toContain('Té observacions');
    expect(text).toContain("En conflicte: ocupa més d'una posició en este segment");
    expect(text).toContain("S'està movent");
    expect(text).toContain('Node extra');
  });

  it('draws every entry with the node drawing itself, so the legend always matches the figure', () => {
    const { panel, toggle } = setup();
    toggle();
    const rows = panel()!.querySelectorAll('li');
    expect(rows.length).toBe(9);
    rows.forEach((row) => expect(row.querySelector('app-node-drawing')).not.toBeNull());
  });

  it('gives each sample a pen of its own, so they don\'t all wobble alike', () => {
    const { fixture, toggle } = setup();
    toggle();
    const keys = fixture.debugElement
      .queryAll(By.directive(NodeDrawingComponent))
      .map((d) => (d.componentInstance as NodeDrawingComponent).sketchKey());
    expect(keys.length).toBe(9);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('draws its samples in the palette of the view: type colors on the pinya, paper on the tronc', () => {
    const pinya = setup().fixture.componentInstance;
    expect(pinya.entries()[0].appearance.fill).toEqual({ style: 'solid', color: NODE_TYPE_PALETTE['vents'].wash });
    TestBed.resetTestingModule();
    const tronc = setup({ palette: 'neutral' }).fixture.componentInstance;
    expect(tronc.entries()[0].appearance.fill).toEqual({ style: 'solid', color: NODE_TYPE_NEUTRAL.wash });
  });

  it('draws its samples in the dark palette when the app is dark, like the figure beside it', () => {
    const { fixture } = setup();
    TestBed.inject(ThemeService).setPreference('dark');
    expect(fixture.componentInstance.entries()[0].appearance.fill).toEqual({ style: 'solid', color: NODE_TYPE_PALETTE_DARK['vents'].wash });
    TestBed.inject(ThemeService).setPreference('system');
    localStorage.clear();
  });
});
