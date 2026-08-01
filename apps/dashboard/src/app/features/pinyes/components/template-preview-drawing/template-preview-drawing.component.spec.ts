import { ComponentFixture, TestBed } from '@angular/core/testing';
import rough from 'roughjs';
import { TemplatePreviewDrawingComponent } from './template-preview-drawing.component';
import { buildSilhouetteMarkup } from './template-preview-drawing.render';
import { hashSeed, layoutTroncSilhouette, layoutTroncGroup } from '../../utils/tronc-silhouette-layout.util';

describe('TemplatePreviewDrawingComponent', () => {
  let fixture: ComponentFixture<TemplatePreviewDrawingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplatePreviewDrawingComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TemplatePreviewDrawingComponent);
  });

  it('renders an accessible svg image', () => {
    fixture.componentRef.setInput('profiles', [[4, 4, 2, 1, 1]]);
    fixture.componentRef.setInput('seedKey', 'Alta clàssica');
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('role')).toBe('img');
  });

  describe('a single figure (a figure-template card)', () => {
    it('names the tronc profile in the accessible label, bottom to top', () => {
      fixture.componentRef.setInput('profiles', [[4, 2]]);
      fixture.componentRef.setInput('seedKey', 'Campana');
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg.getAttribute('aria-label')).toBe('Tronc de 4 · 2');
    });

    it('uses a distinct label for a figure with no tronc', () => {
      fixture.componentRef.setInput('profiles', [[]]);
      fixture.componentRef.setInput('seedKey', 'Piló');
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg.getAttribute('aria-label')).toBe('Figura sense tronc');
    });

    it('draws nothing when the one profile is empty', () => {
      fixture.componentRef.setInput('profiles', [[]]);
      fixture.componentRef.setInput('seedKey', 'Piló');
      fixture.detectChanges();

      const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
      expect(svg.querySelectorAll('path').length).toBe(0);
    });
  });

  describe('several figures (a composition card)', () => {
    it('labels the drawing with the figure count', () => {
      fixture.componentRef.setInput('profiles', [[4, 2], [2, 2], [1]]);
      fixture.componentRef.setInput('seedKey', 'Tanda d\'obertura');
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg.getAttribute('aria-label')).toBe('Composició de 3 figures');
    });

    it('draws sketched people for every drawn figure', () => {
      fixture.componentRef.setInput('profiles', [[2, 1], [3]]);
      fixture.componentRef.setInput('seedKey', 'Rúa gran');
      fixture.detectChanges();

      const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
      expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
    });
  });

  it('draws nothing and reports no figures when given none', () => {
    fixture.componentRef.setInput('profiles', []);
    fixture.componentRef.setInput('seedKey', 'buit');
    fixture.detectChanges();

    const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('aria-label')).toBe('Sense figures');
    expect(svg.querySelectorAll('path').length).toBe(0);
  });

  it('is deterministic: the same profiles and seedKey draw identically across instances', () => {
    fixture.componentRef.setInput('profiles', [[4, 4, 2, 1, 1]]);
    fixture.componentRef.setInput('seedKey', 'Alta clàssica');
    fixture.detectChanges();
    const first = fixture.nativeElement.querySelector('svg').innerHTML;

    const other = TestBed.createComponent(TemplatePreviewDrawingComponent);
    other.componentRef.setInput('profiles', [[4, 4, 2, 1, 1]]);
    other.componentRef.setInput('seedKey', 'Alta clàssica');
    other.detectChanges();
    const second = other.nativeElement.querySelector('svg').innerHTML;

    expect(first).toBe(second);
  });

  it('draws differently for a different seedKey, even with the same profiles', () => {
    fixture.componentRef.setInput('profiles', [[4, 2]]);
    fixture.componentRef.setInput('seedKey', 'Campana');
    fixture.detectChanges();
    const campana = fixture.nativeElement.querySelector('svg').innerHTML;

    const other = TestBed.createComponent(TemplatePreviewDrawingComponent);
    other.componentRef.setInput('profiles', [[4, 2]]);
    other.componentRef.setInput('seedKey', 'Torreta');
    other.detectChanges();
    const torreta = other.nativeElement.querySelector('svg').innerHTML;

    expect(campana).not.toBe(torreta);
  });

  describe('hasPinya', () => {
    it('draws nothing extra by default (a neta figure)', () => {
      fixture.componentRef.setInput('profiles', [[4, 2]]);
      fixture.componentRef.setInput('seedKey', 'Piló');
      fixture.detectChanges();
      const withoutPinya = fixture.nativeElement.querySelector('svg').innerHTML;

      const other = TestBed.createComponent(TemplatePreviewDrawingComponent);
      other.componentRef.setInput('profiles', [[4, 2]]);
      other.componentRef.setInput('seedKey', 'Piló');
      other.componentRef.setInput('hasPinya', false);
      other.detectChanges();

      expect(other.nativeElement.querySelector('svg').innerHTML).toBe(withoutPinya);
    });

    it('still draws a ground line for a neta figure (hasPinya=false), just without the pinya people', () => {
      fixture.componentRef.setInput('profiles', [[2]]);
      fixture.componentRef.setInput('seedKey', 'Piló');
      fixture.detectChanges();

      const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
      const rendered = svg.innerHTML;

      // Compare against the real silhouette-only markup for the identical layout/seed, rather
      // than guessing roughjs's exact path count per primitive (it varies — a filled circle
      // emits more paths than a plain stroke).
      const seed = hashSeed('Piló|2');
      const layout = layoutTroncSilhouette([2], seed);
      const rc = rough.svg(document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement);
      const silhouetteOnly = buildSilhouetteMarkup(rc, layout, seed, 'oklch(var(--p))');

      expect(rendered.match(/<path/g)!.length).toBeGreaterThan(
        silhouetteOnly.match(/<path/g)!.length,
      );
    });

    it('draws the bracing pinya people and a ground line, in the secondary color, when true', () => {
      fixture.componentRef.setInput('profiles', [[4, 2]]);
      fixture.componentRef.setInput('seedKey', 'Campana');
      fixture.componentRef.setInput('hasPinya', true);
      fixture.detectChanges();

      const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
      expect(svg.innerHTML).toContain('oklch(var(--s))');
      expect(svg.innerHTML.match(/<path/g)!.length).toBeGreaterThan(
        (() => {
          const solo = TestBed.createComponent(TemplatePreviewDrawingComponent);
          solo.componentRef.setInput('profiles', [[4, 2]]);
          solo.componentRef.setInput('seedKey', 'Campana');
          solo.detectChanges();
          return solo.nativeElement.querySelector('svg').innerHTML.match(/<path/g)!.length;
        })(),
      );
    });

    it('is ignored for a composition (more than one profile)', () => {
      fixture.componentRef.setInput('profiles', [[4, 2], [2, 2]]);
      fixture.componentRef.setInput('seedKey', 'Tanda');
      fixture.detectChanges();
      const without = fixture.nativeElement.querySelector('svg').innerHTML;

      const other = TestBed.createComponent(TemplatePreviewDrawingComponent);
      other.componentRef.setInput('profiles', [[4, 2], [2, 2]]);
      other.componentRef.setInput('seedKey', 'Tanda');
      other.componentRef.setInput('hasPinya', true);
      other.detectChanges();

      expect(other.nativeElement.querySelector('svg').innerHTML).toBe(without);
    });

    it('still draws a ground line for a composition (several profiles), just without pinya people', () => {
      fixture.componentRef.setInput('profiles', [[4, 2], [2, 2]]);
      fixture.componentRef.setInput('seedKey', 'Tanda');
      fixture.detectChanges();
      const rendered = fixture.nativeElement.querySelector('svg').innerHTML;

      const seed = hashSeed('Tanda|4,2;2,2');
      const layout = layoutTroncGroup([[4, 2], [2, 2]], seed);
      const rc = rough.svg(document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement);
      const silhouetteOnly = buildSilhouetteMarkup(rc, layout, seed, 'oklch(var(--p))');

      expect(rendered.match(/<path/g)!.length).toBeGreaterThan(
        silhouetteOnly.match(/<path/g)!.length,
      );
    });

    it('expands the viewBox to fit the pinya people so they are not clipped', () => {
      fixture.componentRef.setInput('profiles', [[4, 2]]);
      fixture.componentRef.setInput('seedKey', 'Campana');
      fixture.detectChanges();
      const soloViewBox = fixture.nativeElement.querySelector('svg').getAttribute('viewBox');

      const other = TestBed.createComponent(TemplatePreviewDrawingComponent);
      other.componentRef.setInput('profiles', [[4, 2]]);
      other.componentRef.setInput('seedKey', 'Campana');
      other.componentRef.setInput('hasPinya', true);
      other.detectChanges();
      const pinyaViewBox = other.nativeElement.querySelector('svg').getAttribute('viewBox');

      const soloWidth = Number(soloViewBox.split(' ')[2]);
      const pinyaWidth = Number(pinyaViewBox.split(' ')[2]);
      expect(pinyaWidth).toBeGreaterThan(soloWidth);
    });
  });
});
