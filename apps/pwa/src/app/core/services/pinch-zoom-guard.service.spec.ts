import { TestBed } from '@angular/core/testing';
import { PinchZoomGuardService } from './pinch-zoom-guard.service';
import { LayoutService } from './layout.service';

describe('PinchZoomGuardService', () => {
  function dispatchGesture(): Event {
    const event = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(event);
    return event;
  }

  it('blocks the pinch gesture outside fullscreen but allows it while the projection screen is open', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(PinchZoomGuardService);
    const layout = TestBed.inject(LayoutService);
    service.install();

    layout.exitFullscreen();
    expect(dispatchGesture().defaultPrevented).toBe(true);

    layout.requestFullscreen();
    expect(dispatchGesture().defaultPrevented).toBe(false);
  });

  it('only installs its listeners once', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(PinchZoomGuardService);
    service.install();

    const addSpy = vi.spyOn(document, 'addEventListener');
    service.install();
    expect(addSpy).not.toHaveBeenCalled();
  });
});
