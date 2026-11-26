import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef, Component, input, output, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of, throwError, NEVER, Observable } from 'rxjs';
import { Router } from '@angular/router';
import {
  AssignmentDetail,
  AssignmentPersonDetail,
  PinyaProjectionComponent,
  ProjectionInstance,
  ProjectionSegmentData,
} from '@muixer/pinyes-render';
import { THEME_NAMES } from '@muixer/ui';
import { SegmentProjectionComponent } from './segment-projection.component';
import { ProjectionService } from '../services/projection.service';
import { LayoutService } from '../../../core/services/layout.service';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({ selector: 'lib-pinya-projection', standalone: true, template: '' })
class PinyaProjectionStub {
  readonly data = input.required<unknown>();
  readonly instanceId = input<string | null>(null);
  readonly showZoomControls = input<boolean>(true);
  readonly showFitButton = input<boolean>(true);
  readonly highlightPersonId = input<string | null>(null);
  readonly highlightPersonName = input<string | null>(null);
  readonly backToSelf = output<void>();
  readonly onTroba = vi.fn();
}

const makePerson = (overrides: Partial<AssignmentPersonDetail> = {}): AssignmentPersonDetail => ({
  id: 'p1',
  alias: 'Marta',
  name: 'Marta',
  firstSurname: 'Puig',
  shoulderHeight: null,
  notes: null,
  notesEmoji: null,
  ...overrides,
});

const makeAssignment = (person: AssignmentPersonDetail): AssignmentDetail => ({
  id: `a-${person.id}`,
  figureInstanceId: 'i1',
  node: {
    id: `n-${person.id}`,
    label: 'Lateral',
    zone: 'PINYA',
    z: 0,
    positionType: null,
    sortOrder: 0,
    climbIndicator: null,
    ringLevel: null,
    originNodeId: null,
    sourceNodeId: null,
  },
  person,
});

const makeInstance = (assignments: AssignmentDetail[], overrides: Partial<ProjectionInstance> = {}): ProjectionInstance => ({
  id: 'i1',
  label: null,
  sortOrder: 0,
  numberOfCordons: null,
  projectionX: null,
  projectionY: null,
  projectionScale: 1,
  projectionAngle: 0,
  troncPanelX: null,
  troncPanelY: null,
  troncPanelWidth: null,
  troncPanelHeight: null,
  figureMode: 'COMPLETA',
  figureTemplate: null,
  nodes: [],
  assignments,
  ...overrides,
});

/** Minimal AuthService stub — only `currentUser().person.id` is read by this component. */
const makeAuthService = (personId: string | null) => ({
  currentUser: () => ({ person: personId ? { id: personId } : null }),
});

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

  async function setup(getProjectionReturn = of(makeData()), personId: string | null = 'p1') {
    projectionService = { getProjection: vi.fn().mockReturnValue(getProjectionReturn) };
    router = { navigate: vi.fn() };
    layoutService = { requestFullscreen: vi.fn(), exitFullscreen: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: ProjectionService, useValue: projectionService },
        { provide: Router, useValue: router },
        { provide: LayoutService, useValue: layoutService },
        { provide: AuthService, useValue: makeAuthService(personId) },
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

  it('hides the fit-to-screen button — the camera flies to the person instead', async () => {
    fixture = await setup(of(makeData()));
    const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
    expect(stub.componentInstance.showFitButton()).toBe(false);
  });

  it("forwards the caller's own linked person id as highlightPersonId", async () => {
    fixture = await setup(of(makeData()), 'p1');
    const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
    expect(stub.componentInstance.highlightPersonId()).toBe('p1');
  });

  it('forwards null as highlightPersonId when the account has no linked person', async () => {
    fixture = await setup(of(makeData()), null);
    const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
    expect(stub.componentInstance.highlightPersonId()).toBeNull();
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
        { provide: AuthService, useValue: makeAuthService('p1') },
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

  it('routes back to the event when the browser back button is pressed', async () => {
    fixture = await setup();

    window.dispatchEvent(new PopStateEvent('popstate'));

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
      expect(router.navigate).toHaveBeenCalledWith(
        ['/events', 'ev-1', 'segments', 'seg-2'],
        expect.anything(),
      );
    });

    it('shows and navigates the prev control when prevSegmentId is set', async () => {
      fixture = await setup(of(makeData({ segment: { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, prevSegmentId: 'seg-0', nextSegmentId: null } })));

      const prevBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Segment anterior"]');
      expect(prevBtn).toBeTruthy();
      prevBtn.click();
      expect(router.navigate).toHaveBeenCalledWith(
        ['/events', 'ev-1', 'segments', 'seg-0'],
        expect.anything(),
      );
    });

    it('replaces history on prev/next navigation, so the browser back button skips straight past every segment visited to the event screen', async () => {
      fixture = await setup(of(makeData({ segment: { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, prevSegmentId: null, nextSegmentId: 'seg-2' } })));

      const nextBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Segment següent"]');
      nextBtn.click();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/events', 'ev-1', 'segments', 'seg-2'],
        expect.objectContaining({ replaceUrl: true }),
      );
    });
  });

  describe('theme', () => {
    const themeOf = (el: Element | null) => el?.closest('[data-theme]')?.getAttribute('data-theme') ?? null;
    const withPeople = () => of(makeData({ instances: [makeInstance([makeAssignment(makePerson({ id: 'p-x', alias: 'Xavi' }))])] }));

    it('draws the figure in the page theme: the canvas has a dark look of its own', async () => {
      fixture = await setup(withPeople());
      expect(themeOf(fixture.nativeElement.querySelector('lib-pinya-projection'))).toBeNull();
    });

    it('draws the HUD controls dark in either page theme', async () => {
      fixture = await setup(withPeople());
      expect(themeOf(fixture.nativeElement.querySelector('nav[aria-label="Navegació de la projecció"]'))).toBe(THEME_NAMES.dark);
      expect(themeOf(fixture.nativeElement.querySelector('[aria-label="Cerca una persona"]'))).toBe(THEME_NAMES.dark);
    });

    it('lets the person picker follow the page theme', async () => {
      fixture = await setup(withPeople());
      expect(themeOf(fixture.nativeElement.querySelector('lib-modal'))).toBeNull();
    });
  });

  describe('looking up another person', () => {
    const marta = makePerson({ id: 'p-marta', alias: 'Marta', name: 'Marta', firstSurname: 'Puig' });
    const anna = makePerson({ id: 'p-anna', alias: 'Anna', name: 'Anna', firstSurname: 'Ferrer' });

    const searchButton = (f: ComponentFixture<TestHostComponent>): HTMLButtonElement | null =>
      f.nativeElement.querySelector('[aria-label="Cerca una persona"]');
    const filterInput = (f: ComponentFixture<TestHostComponent>): HTMLInputElement | null =>
      // `data-testid` (an unrecognized static attribute) lands on `lib-input`'s own
      // `display:contents` host, not the real native control — scope past it.
      f.nativeElement.querySelector('[data-testid="participant-filter"] input');
    const participantRows = (f: ComponentFixture<TestHostComponent>): HTMLElement[] =>
      Array.from(f.nativeElement.querySelectorAll('[data-testid="participant-row"]'));

    const openPicker = (f: ComponentFixture<TestHostComponent>) => {
      searchButton(f)!.click();
      f.detectChanges();
    };

    it('hides the search button when nobody is placed in this segment', async () => {
      fixture = await setup(of(makeData({ instances: [makeInstance([])] })));
      expect(searchButton(fixture)).toBeNull();
    });

    it('shows the search button once someone is placed in this segment', async () => {
      fixture = await setup(of(makeData({ instances: [makeInstance([makeAssignment(marta)])] })));
      expect(searchButton(fixture)).toBeTruthy();
    });

    it('lists every distinct participant, deduplicating repeat placements of the same person', async () => {
      const dup = makeAssignment(marta);
      fixture = await setup(
        of(makeData({ instances: [makeInstance([makeAssignment(marta), dup, makeAssignment(anna)])] })),
      );
      openPicker(fixture);

      expect(participantRows(fixture).map((el) => el.textContent?.trim())).toEqual(['Marta', 'Anna']);
    });

    it('filters the list by alias, case- and accent-insensitively', async () => {
      fixture = await setup(
        of(makeData({ instances: [makeInstance([makeAssignment(marta), makeAssignment(anna)])] })),
      );
      openPicker(fixture);

      filterInput(fixture)!.value = 'ANN';
      filterInput(fixture)!.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(participantRows(fixture).map((el) => el.textContent?.trim())).toEqual(['Anna']);
    });

    it('shows a not-found message when the filter matches nobody in this segment', async () => {
      fixture = await setup(of(makeData({ instances: [makeInstance([makeAssignment(marta)])] })));
      openPicker(fixture);

      filterInput(fixture)!.value = 'Zzz';
      filterInput(fixture)!.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        "No hi ha ningú amb eixe nom en este segment.",
      );
    });

    it('forwards the selected participant to lib-pinya-projection and closes the picker', async () => {
      fixture = await setup(of(makeData({ instances: [makeInstance([makeAssignment(marta)])] })), 'p1');
      openPicker(fixture);

      participantRows(fixture)[0].click();
      fixture.detectChanges();

      const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
      expect(stub.componentInstance.highlightPersonId()).toBe('p-marta');
      expect(stub.componentInstance.highlightPersonName()).toBe('Marta');
      expect(filterInput(fixture)).toBeNull();
    });

    it('treats selecting oneself the same as never having looked anyone up', async () => {
      const self = makePerson({ id: 'p1', alias: 'Jo Mateixa', name: 'Jo', firstSurname: 'Mateixa' });
      fixture = await setup(
        of(makeData({ instances: [makeInstance([makeAssignment(self), makeAssignment(marta)])] })),
        'p1',
      );
      openPicker(fixture);

      participantRows(fixture)
        .find((el) => el.textContent?.trim() === 'Jo Mateixa')!
        .click();
      fixture.detectChanges();

      const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
      expect(stub.componentInstance.highlightPersonId()).toBe('p1');
      expect(stub.componentInstance.highlightPersonName()).toBeNull();
    });

    it("defaults to the caller's own position with no name, before anyone is looked up", async () => {
      fixture = await setup(of(makeData({ instances: [makeInstance([makeAssignment(marta)])] })), 'p1');

      const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
      expect(stub.componentInstance.highlightPersonId()).toBe('p1');
      expect(stub.componentInstance.highlightPersonName()).toBeNull();
    });

    it("restores the caller's own position when lib-pinya-projection emits backToSelf", async () => {
      fixture = await setup(of(makeData({ instances: [makeInstance([makeAssignment(marta)])] })), 'p1');
      openPicker(fixture);
      participantRows(fixture)[0].click();
      fixture.detectChanges();

      const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
      stub.componentInstance.backToSelf.emit();
      fixture.detectChanges();

      expect(stub.componentInstance.highlightPersonId()).toBe('p1');
      expect(stub.componentInstance.highlightPersonName()).toBeNull();
    });

    it('focuses the filter input when the picker opens', async () => {
      fixture = await setup(of(makeData({ instances: [makeInstance([makeAssignment(marta)])] })));
      openPicker(fixture);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(document.activeElement).toBe(filterInput(fixture));
    });

    it('flies to the new placement when a participant is selected', async () => {
      fixture = await setup(of(makeData({ instances: [makeInstance([makeAssignment(marta)])] })), 'p1');
      openPicker(fixture);

      participantRows(fixture)[0].click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
      expect(stub.componentInstance.onTroba).toHaveBeenCalled();
    });

    it("flies back to the caller's own placement when backToSelf fires", async () => {
      fixture = await setup(of(makeData({ instances: [makeInstance([makeAssignment(marta)])] })), 'p1');
      openPicker(fixture);
      participantRows(fixture)[0].click();
      fixture.detectChanges();

      const stub = fixture.debugElement.query(By.directive(PinyaProjectionStub));
      stub.componentInstance.onTroba.mockClear();
      stub.componentInstance.backToSelf.emit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(stub.componentInstance.onTroba).toHaveBeenCalled();
    });
  });

  describe('live refresh', () => {
    const TODAY = '2026-07-15';
    const POLL = 36_000; // PWA_REVISION_POLL_MS + PWA_REVISION_JITTER_MS
    const marta = makePerson({ id: 'p-marta', alias: 'Marta' });
    const dataOn = (date: string, segId = 'seg-1', nextSegmentId: string | null = null) =>
      makeData({
        segment: { id: segId, name: 'Bloc', sortOrder: 0, prevSegmentId: null, nextSegmentId },
        event: { date, startTime: '19:00' },
        instances: [makeInstance([makeAssignment(marta)])],
      });

    @Component({
      standalone: true,
      imports: [SegmentProjectionComponent],
      template: `<app-segment-projection [eventId]="'ev-1'" [segmentId]="segmentId()" />`,
    })
    class NavHostComponent {
      readonly segmentId = signal('seg-1');
    }

    let revisionCalls: Array<[string, string]>;
    let revisions: Array<Observable<{ revision: string }>>;
    let host: ComponentFixture<NavHostComponent>;

    async function setupLive(
      getProjection: (e: string, s: string) => Observable<ProjectionSegmentData>,
      revisionSeq: Array<Observable<{ revision: string }>> = [],
    ) {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.setSystemTime(new Date('2026-07-15T10:00:00Z'));
      revisionCalls = [];
      revisions = [...revisionSeq];
      projectionService = { getProjection: vi.fn(getProjection) };
      (projectionService as unknown as Record<string, unknown>)['getRevision'] = vi.fn((e: string, s: string) => {
        revisionCalls.push([e, s]);
        return revisions.length > 1 ? revisions.shift()! : (revisions[0] ?? of({ revision: 'r1' }));
      });
      layoutService = { requestFullscreen: vi.fn(), exitFullscreen: vi.fn() };
      await TestBed.configureTestingModule({
        imports: [NavHostComponent],
        providers: [
          { provide: ProjectionService, useValue: projectionService },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: LayoutService, useValue: layoutService },
          { provide: AuthService, useValue: makeAuthService('p1') },
        ],
      })
        .overrideComponent(SegmentProjectionComponent, {
          remove: { imports: [PinyaProjectionComponent] },
          add: { imports: [PinyaProjectionStub] },
        })
        .compileComponents();
      host = TestBed.createComponent(NavHostComponent);
      host.detectChanges();
      await TestBed.inject(ApplicationRef).whenStable();
      host.detectChanges();
    }

    // `settle: false` when a request is left pending on purpose: the app never becomes stable.
    const tick = async (ms = POLL, settle = true) => {
      await vi.advanceTimersByTimeAsync(ms);
      host.detectChanges();
      if (settle) await TestBed.inject(ApplicationRef).whenStable();
      host.detectChanges();
    };
    const stub = () => host.debugElement.query(By.directive(PinyaProjectionStub));

    afterEach(() => vi.useRealTimers());

    it('polls the revision only on the day of the event', async () => {
      await setupLive(() => of(dataOn('2026-07-16')));
      await tick();
      expect(revisionCalls).toHaveLength(0);
      TestBed.resetTestingModule();
      await setupLive(() => of(dataOn('2026-07-14')));
      await tick();
      expect(revisionCalls).toHaveLength(0);
      TestBed.resetTestingModule();
      await setupLive(() => of(dataOn(TODAY)));
      expect(revisionCalls).toHaveLength(1);
    });

    it('reloads the projection when the revision changes', async () => {
      await setupLive(() => of(dataOn(TODAY)), [of({ revision: 'a' }), of({ revision: 'b' })]);
      expect(projectionService.getProjection).toHaveBeenCalledTimes(1);
      await tick();
      expect(projectionService.getProjection).toHaveBeenCalledTimes(2);
    });

    it('keeps the projection mounted during a background reload (no spinner)', async () => {
      let n = 0;
      await setupLive(() => (n++ === 0 ? of(dataOn(TODAY)) : NEVER), [of({ revision: 'a' }), of({ revision: 'b' })]);
      const before = stub().nativeElement;
      await tick(POLL, false);
      expect(projectionService.getProjection).toHaveBeenCalledTimes(2);
      expect(host.nativeElement.querySelector('[role="status"]')).toBeNull();
      expect(stub().nativeElement).toBe(before);
    });

    it('keeps selectedParticipant and an open picker across a background reload', async () => {
      await setupLive(() => of(dataOn(TODAY)), [of({ revision: 'a' }), of({ revision: 'b' })]);
      host.nativeElement.querySelector('[aria-label="Cerca una persona"]').click();
      host.detectChanges();
      expect(host.nativeElement.querySelector('[data-testid="participant-filter"]')).toBeTruthy();
      await tick();
      expect(projectionService.getProjection).toHaveBeenCalledTimes(2);
      expect(host.nativeElement.querySelector('[data-testid="participant-filter"]')).toBeTruthy();
      host.nativeElement.querySelector('[data-testid="participant-row"]').click();
      host.detectChanges();
      expect(stub().componentInstance.highlightPersonId()).toBe('p-marta');
    });

    it('does not re-trigger the flight on a background reload', async () => {
      await setupLive(() => of(dataOn(TODAY)), [of({ revision: 'a' }), of({ revision: 'b' })]);
      await tick();
      expect(projectionService.getProjection).toHaveBeenCalledTimes(2);
      expect(stub().componentInstance.onTroba).not.toHaveBeenCalled();
    });

    it('keeps showing the last projection when a background reload fails', async () => {
      let n = 0;
      await setupLive(
        () => (n++ === 0 ? of(dataOn(TODAY)) : throwError(() => new Error('down'))),
        [of({ revision: 'a' }), of({ revision: 'b' })],
      );
      await tick();
      expect(projectionService.getProjection).toHaveBeenCalledTimes(2);
      expect(stub()).toBeTruthy();
      expect(host.nativeElement.textContent).not.toContain("No s'ha pogut carregar");
      // the failed reload did not consume the change: the next tick retries it
      await tick();
      expect(projectionService.getProjection).toHaveBeenCalledTimes(3);
    });

    it('sends the poll-triggered reload past the service worker cache, but not the first load', async () => {
      await setupLive(() => of(dataOn(TODAY)), [of({ revision: 'a' }), of({ revision: 'b' })]);
      await tick();
      const calls = (projectionService.getProjection as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][2]).toBeUndefined();
      expect(calls[1][2]).toBe(true);
    });

    it('keeps showing the last projection when the revision endpoint answers 404', async () => {
      await setupLive(() => of(dataOn(TODAY)), [throwError(() => new Error('404'))]);
      await tick(POLL * 2);
      expect(revisionCalls.length).toBeGreaterThan(1);
      expect(stub()).toBeTruthy();
      expect(projectionService.getProjection).toHaveBeenCalledTimes(1);
    });

    it('restarts polling with a fresh baseline after prev/next', async () => {
      await setupLive((_, s) => of(dataOn(TODAY, s, 'seg-2')), [of({ revision: 'a' })]);
      host.componentInstance.segmentId.set('seg-2');
      host.detectChanges();
      await TestBed.inject(ApplicationRef).whenStable();
      host.detectChanges();
      expect(revisionCalls.map((c) => c[1])).toEqual(['seg-1', 'seg-2']);
      // a different revision for the new segment is its baseline, not a change
      expect(projectionService.getProjection).toHaveBeenCalledTimes(2);
    });

    it('still shows the spinner on first load and when navigating to another segment', async () => {
      await setupLive((_, s) => (s === 'seg-1' ? of(dataOn(TODAY)) : NEVER));
      expect(host.nativeElement.querySelector('[role="status"]')).toBeNull();
      host.componentInstance.segmentId.set('seg-2');
      await tick(0, false);
      expect(host.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    });

    it('stops polling on destroy', async () => {
      await setupLive(() => of(dataOn(TODAY)));
      host.destroy();
      const calls = revisionCalls.length;
      await vi.advanceTimersByTimeAsync(POLL * 3);
      expect(revisionCalls).toHaveLength(calls);
    });
  });
});
