import { TestBed } from '@angular/core/testing';
import { FigureCanvasComponent } from './figure-canvas.component';

describe('FigureCanvasComponent', () => {
  it('follows the app theme instead of pinning the light one', () => {
    // The Konva stage needs a real canvas (absent in jsdom) — only the host is under test here.
    TestBed.overrideComponent(FigureCanvasComponent, { set: { template: '' } });
    jest.spyOn(FigureCanvasComponent.prototype, 'ngAfterViewInit').mockImplementation(() => undefined);
    jest.spyOn(FigureCanvasComponent.prototype, 'ngOnDestroy').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(FigureCanvasComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.hasAttribute('data-theme')).toBe(false);
  });
});
