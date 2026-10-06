import { TestBed } from '@angular/core/testing';
import { THEME_NAMES } from '@muixer/ui';
import { FigureCanvasComponent } from './figure-canvas.component';

describe('FigureCanvasComponent', () => {
  it('is pinned to the light theme until the canvas is themed for dark mode', () => {
    // The Konva stage needs a real canvas (absent in jsdom) — only the host is under test here.
    TestBed.overrideComponent(FigureCanvasComponent, { set: { template: '' } });
    jest.spyOn(FigureCanvasComponent.prototype, 'ngAfterViewInit').mockImplementation(() => undefined);
    jest.spyOn(FigureCanvasComponent.prototype, 'ngOnDestroy').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(FigureCanvasComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.dataset['theme']).toBe(THEME_NAMES.light);
  });
});
