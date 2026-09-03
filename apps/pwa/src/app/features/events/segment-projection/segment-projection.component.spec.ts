import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef, Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of, throwError, NEVER } from 'rxjs';
import { Router } from '@angular/router';
import {
  AssignmentDetail,
  AssignmentPersonDetail,
  PinyaProjectionComponent,
  ProjectionInstance,
  ProjectionSegmentData,
} from '@muixer/pinyes-render';
import { SegmentProjectionComponent } from './segment-projection.component';
import { ProjectionService } from '../services/projection.service';
import { LayoutService } from '../../../core/services/layout.service';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({ selector: 'lib-pinya-projection', standalone: true, template: '' })
class PinyaProjectionStub {
  readonly data = input.required<unknown>();
  readonly instanceId = input<string | null>(null);
  readonly showZoomControls = input<boolean>(true);
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

  describe('looking up another person', () => {
    const marta = makePerson({ id: 'p-marta', alias: 'Marta', name: 'Marta', firstSurname: 'Puig' });
    const anna = makePerson({ id: 'p-anna', alias: 'Anna', name: 'Anna', firstSurname: 'Ferrer' });

    const searchButton = (f: ComponentFixture<TestHostComponent>): HTMLButtonElement | null =>
      f.nativeElement.querySelector('[aria-label="Cerca una persona"]');
    const filterInput = (f: ComponentFixture<TestHostComponent>): HTMLInputElement | null =>
      f.nativeElement.querySelector('[data-testid="participant-filter"]');
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
});
