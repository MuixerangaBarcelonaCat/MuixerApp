import { TestBed } from '@angular/core/testing';
import { ThemeService } from '@muixer/ui';
import { paperGrain } from '../../theme/paper-grain';
import { FigureCanvasComponent } from './figure-canvas.component';

describe('FigureCanvasComponent', () => {
  // The Konva stage needs a real canvas (absent in jsdom) — only the host is under test here.
  function render() {
    TestBed.overrideComponent(FigureCanvasComponent, { set: { template: '' } });
    jest.spyOn(FigureCanvasComponent.prototype, 'ngAfterViewInit').mockImplementation(() => undefined);
    jest.spyOn(FigureCanvasComponent.prototype, 'ngOnDestroy').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(FigureCanvasComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('follows the app theme instead of pinning the light one', () => {
    expect(render().nativeElement.hasAttribute('data-theme')).toBe(false);
  });

  it('lays the canvas on grained paper, the grain of the app theme', () => {
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--paper-grain')).toBe(paperGrain('light'));
    try {
      TestBed.inject(ThemeService).setPreference('dark');
      fixture.detectChanges();
      expect(host.style.getPropertyValue('--paper-grain')).toBe(paperGrain('dark'));
    } finally {
      TestBed.inject(ThemeService).setPreference('system');
      localStorage.clear();
    }
  });
});
