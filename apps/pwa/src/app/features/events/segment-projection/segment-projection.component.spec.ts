import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef, Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of, throwError, NEVER } from 'rxjs';
import { Router } from '@angular/router';
import { PinyaProjectionComponent, ProjectionSegmentData } from '@muixer/pinyes-render';
import { SegmentProjectionComponent } from './segment-projection.component';
import { ProjectionService } from '../services/projection.service';
import { LayoutService } from '../../../core/services/layout.service';

@Component({ selector: 'lib-pinya-projection', standalone: true, template: '' })
class PinyaProjectionStub {
  readonly data = input.required<unknown>();
  readonly instanceId = input<string | null>(null);
  readonly showZoomControls = input<boolean>(true);
}

@Component({
  standalone: true,
  imports: [SegmentProjectionComponent],
  template: `<app-segment-projection [eventId]="'ev-1'" [segmentId]="'seg-1'" />`,
})
class TestHostComponent {}

const makeData = (overrides: Partial<ProjectionSegmentData> = {}): ProjectionSegmentData => ({
  segment: { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
  instances: [],
  personAttendance: {},
  hasDistribution: false,
  conflicts: [],
  ...overrides,
});

describe('SegmentProjectionComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let projectionService: { getProjection: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let layoutService: { requestFullscreen: ReturnType<typeof vi.fn>; exitFullscreen: ReturnType<typeof vi.fn> };

  async function setup(getProjectionReturn = of(makeData())) {
    projectionService = { getProjection: vi.fn().mockReturnValue(getProjectionReturn) };
    router = { navigate: vi.fn() };
    layoutService = { requestFullscreen: vi.fn(), exitFullscreen: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: ProjectionService, useValue: projectionService },
        { provide: Router, useValue: router },
        { provide: LayoutService, useValue: layoutService },
      ],
    })
      .overrideComponent(SegmentProjectionComponent, {
        remove: { imports: [PinyaProjectionComponent] },
        add: { imports: [PinyaProjectionStub] },
      })
      .compileComponents();

    const f = TestBed.createComponent(TestHostComponent);
    f.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    f.detectChanges();
    return f;
  }

  it('fetches the projection for the given event and segment', async () => {
    fixture = await setup();
    expect(projectionService.getProjection).toHaveBeenCalledWith('ev-1', 'seg-1');
  });

  it('renders lib-pinya-projection with the fetched data once loaded', async () => {
    fixture = await setup(of(makeData()));
    const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
    expect(stub).toBeTruthy();
    expect(stub.componentInstance.data().segment.id).toBe('seg-1');
  });

  it('hides the zoom-percentage selector — touch pinch/wheel zoom still work, it just clutters a small screen', async () => {
    fixture = await setup(of(makeData()));
    const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
    expect(stub.componentInstance.showZoomControls()).toBe(false);
  });

  it('shows a loading state before the projection resolves', async () => {
    projectionService = { getProjection: vi.fn().mockReturnValue(NEVER) };
    router = { navigate: vi.fn() };
    layoutService = { requestFullscreen: vi.fn(), exitFullscreen: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: ProjectionService, useValue: projectionService },
        { provide: Router, useValue: router },
        { provide: LayoutService, useValue: layoutService },
      ],
    })
      .overrideComponent(SegmentProjectionComponent, {
        remove: { imports: [PinyaProjectionComponent] },
        add: { imports: [PinyaProjectionStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('shows an error state when the fetch fails', async () => {
    fixture = await setup(throwError(() => new Error('fail')));
    expect(fixture.nativeElement.textContent).toContain("No s'ha pogut carregar");
  });

  it('routes back to the event when the back button is pressed', async () => {
    fixture = await setup();
    const backBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="Torna a l\'esdeveniment"]',
    );
    backBtn.click();
    expect(router.navigate).toHaveBeenCalledWith(['/events', 'ev-1']);
  });

  describe('fullscreen chrome', () => {
    it('requests fullscreen on init, so the bottom tab bar is hidden while viewing the figure', async () => {
      fixture = await setup();
      expect(layoutService.requestFullscreen).toHaveBeenCalled();
    });

    it('exits fullscreen on destroy, restoring the bottom tab bar', async () => {
      fixture = await setup();
      fixture.destroy();
      expect(layoutService.exitFullscreen).toHaveBeenCalled();
    });
  });

  describe('prev/next navigation', () => {
    it('hides prev/next controls when both are null', async () => {
      fixture = await setup(of(makeData({ segment: { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, prevSegmentId: null, nextSegmentId: null } })));

      expect(fixture.nativeElement.querySelector('[aria-label="Segment anterior"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[aria-label="Segment següent"]')).toBeNull();
    });

    it('shows and navigates the next control when nextSegmentId is set', async () => {
      fixture = await setup(of(makeData({ segment: { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, prevSegmentId: null, nextSegmentId: 'seg-2' } })));

      const nextBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Segment següent"]');
      expect(nextBtn).toBeTruthy();
      nextBtn.click();
      expect(router.navigate).toHaveBeenCalledWith(['/events', 'ev-1', 'segments', 'seg-2']);
    });

    it('shows and navigates the prev control when prevSegmentId is set', async () => {
      fixture = await setup(of(makeData({ segment: { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, prevSegmentId: 'seg-0', nextSegmentId: null } })));

      const prevBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Segment anterior"]');
      expect(prevBtn).toBeTruthy();
      prevBtn.click();
      expect(router.navigate).toHaveBeenCalledWith(['/events', 'ev-1', 'segments', 'seg-0']);
    });
  });
});
