import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '@muixer/ui';
import { buildCanvasTheme } from '../../theme/canvas-theme';
import { CardEdge } from '../../utils/figure-link.util';
import { PinnedCardComponent } from './pinned-card.component';

const theme = buildCanvasTheme();
/** How jsdom reads back a hex colour set as a style. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

@Component({
  standalone: true,
  imports: [PinnedCardComponent],
  template: `<lib-pinned-card [color]="color()" [edge]="edge()"><p data-content>Pilar</p></lib-pinned-card>`,
})
class HostComponent {
  readonly color = signal('#3b6fc2');
  readonly edge = signal<CardEdge>('top');
}

describe('PinnedCardComponent', () => {
  afterEach(() => {
    TestBed.inject(ThemeService).setPreference('system');
    localStorage.clear();
  });

  function render(set: Partial<{ color: string; edge: CardEdge }> = {}) {
    const fixture = TestBed.createComponent(HostComponent);
    if (set.color) fixture.componentInstance.color.set(set.color);
    if (set.edge) fixture.componentInstance.edge.set(set.edge);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      card: el.querySelector('[data-role="card"]') as HTMLElement,
      face: el.querySelector('[data-role="face"]') as HTMLElement,
      edge: el.querySelector('[data-role="edge"]') as HTMLElement,
      pin: el.querySelector('[data-role="pin"]') as SVGSVGElement,
    };
  }

  it('lays the content on a paper face, framed in a crease tone', () => {
    const { face } = render();
    expect(face.querySelector('[data-content]')?.textContent).toBe('Pilar');
    expect(face.style.backgroundColor).toBe(rgb(theme.card));
    expect(face.style.borderColor).toBe(rgb(theme.cardBorder));
  });

  it('sits on a flat edge of darker paper, offset down and right instead of a shadow', () => {
    const { edge } = render();
    expect(edge.style.transform).toBe('translate(4px, 5px)');
    expect(edge.style.backgroundColor).toBe(rgb(theme.cardEdge));
  });

  it('holds the card with one pin in the figure colour, on the middle of the given edge', () => {
    const at = (edge: CardEdge) => {
      const { pin } = render({ edge });
      return [pin.style.left, pin.style.top];
    };
    expect(at('top')).toEqual(['50%', '0%']);
    expect(at('bottom')).toEqual(['50%', '100%']);
    expect(at('left')).toEqual(['0%', '50%']);
    expect(at('right')).toEqual(['100%', '50%']);
    const circles = render({ color: '#277c64' }).pin.querySelectorAll('circle');
    expect(circles).toHaveLength(3);
    expect(circles[1].getAttribute('fill')).toBe('#277c64');
  });

  it('turns into a dark card, a step above the dark canvas, when the app is dark', () => {
    TestBed.inject(ThemeService).setPreference('dark');
    const dark = buildCanvasTheme('dark');
    const { face, edge, pin } = render();
    expect(face.style.backgroundColor).toBe(rgb(dark.card));
    expect(face.style.borderColor).toBe(rgb(dark.cardBorder));
    expect(edge.style.backgroundColor).toBe(rgb(dark.cardEdge));
    expect(pin.querySelectorAll('circle')[0].getAttribute('fill')).toBe(dark.pinShadow);
  });

  it('stands straight, whatever edge holds the pin', () => {
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      expect(render({ edge }).card.style.transform).toBe('');
    }
  });
});
