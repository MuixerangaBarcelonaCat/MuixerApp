import { Component, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LucideAngularModule } from 'lucide-angular';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { SegmentWorkspaceComponent } from './segment-workspace.component';
import { SegmentWorkspaceStateService, WorkspaceInstance } from '../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { UndoRedoService } from '../../services/undo-redo.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';

@Component({ selector: 'app-pinyes-tab', standalone: true, template: '' })
class StubPinyesTab {
  readonly isPast = input(false);
}

@Component({ selector: 'app-troncs-tab', standalone: true, template: '' })
class StubTroncsTab {
  readonly isPast = input(false);
}

@Component({ selector: 'app-distribucio-tab', standalone: true, template: '' })
class StubDistribucioTab {}

@Component({ selector: 'app-nodes-tab', standalone: true, template: '' })
class StubNodesTab {
  readonly isPast = input(false);
}

@Component({ selector: 'app-previsualitza-tab', standalone: true, template: '' })
class StubPrevisualitzaTab {}

const EVENT_ID = 'event-1';
const SEGMENT_ID = 'seg-1';

const makeWorkspaceInstance = (id: string): WorkspaceInstance => ({
  instanceId: id,
  label: `Figura ${id}`,
  figureTemplateId: `tpl-${id}`,
  figureTemplateName: `Figura ${id}`,
  hasPinya: true,
  figureMode: 'COMPLETA',
  snapshotted: false,
  numberOfCordons: null,
  cordonsObertsEnabled: true,
  nodes: [],
  assignedCount: 0,
  totalCount: 0,
});

type WsMock = ReturnType<typeof makeWsMock>;

const makeWsMock = () => {
  const eventId = signal('');
  const segmentId = signal('');
  return {
    eventId,
    segmentId,
    loading: signal(false),
    notFound: signal(false),
    segment: signal(null),
    segmentName: signal<string | null>('Bloc 1'),
    previousSegmentId: signal<string | null>(null),
    nextSegmentId: signal<string | null>(null),
    segmentPosition: signal<{ current: number; total: number } | null>(null),
    instances: signal<WorkspaceInstance[]>([makeWorkspaceInstance('inst-a'), makeWorkspaceInstance('inst-b')]),
    distributionByInstance: signal(new Map()),
    selectedInstanceId: signal<string | null>(null),
    selectedInstance: signal<WorkspaceInstance | null>(null),
    lockStatus: signal(null),
    isLocked: signal(false),
    personsLoaded: signal(true),
    pinyaSlots: signal([]),
    pendingSelection: signal<{ slotId: string; nodeId: string } | null>(null),
    load: vi.fn((id: string, segId: string) => {
      eventId.set(id);
      segmentId.set(segId);
    }),
    refreshInstance: vi.fn(),
    selectInstance: vi.fn(),
    visibleNodesFor: vi.fn().mockReturnValue([]),
  };
};

describe('SegmentWorkspaceComponent', () => {
  let ws: WsMock;
  let layoutService: { requestFullscreen: ReturnType<typeof vi.fn>; exitFullscreen: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const setup = async (opts: { queryParams?: Record<string, string>; instanceIdParam?: string } = {}) => {
    ws = makeWsMock();
    layoutService = { requestFullscreen: vi.fn(), exitFullscreen: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    const params: Record<string, string> = { eventId: EVENT_ID, segmentId: SEGMENT_ID };
    if (opts.instanceIdParam) params['instanceId'] = opts.instanceIdParam;
    const queryParams = opts.queryParams ?? {};
    paramMap$ = new BehaviorSubject(convertToParamMap(params));

    await TestBed.configureTestingModule({
      imports: [SegmentWorkspaceComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        AssignmentStateService,
        { provide: LayoutService, useValue: layoutService },
        { provide: ToastService, useValue: toast },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params,
              queryParams,
              queryParamMap: { get: (key: string) => queryParams[key] ?? null },
            },
            paramMap: paramMap$,
          },
        },
      ],
    })
      .overrideComponent(SegmentWorkspaceComponent, {
        set: {
          providers: [
            { provide: SegmentWorkspaceStateService, useValue: ws },
            UndoRedoService,
          ],
          imports: [
          LucideAngularModule,
          StubPinyesTab,
          StubTroncsTab,
          StubDistribucioTab,
          StubNodesTab,
          StubPrevisualitzaTab,
        ],
        },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(SegmentWorkspaceComponent);
    fixture.detectChanges();
    return fixture;
  };

  const tabLabels = (fixture: ComponentFixture<SegmentWorkspaceComponent>): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')).map((el) =>
      ((el as HTMLElement).textContent ?? '').trim(),
    );

  it('requests fullscreen on init and exits on destroy', async () => {
    const fixture = await setup();
    expect(layoutService.requestFullscreen).toHaveBeenCalled();
    fixture.destroy();
    expect(layoutService.exitFullscreen).toHaveBeenCalled();
  });

  it('loads the workspace with the route params', async () => {
    await setup();
    expect(ws.load).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
  });

  it('shows the five workspace tabs', async () => {
    const fixture = await setup();
    expect(tabLabels(fixture)).toEqual(['Pinyes', 'Troncs', 'Distribució', 'Nodes extra', 'Previsualitza']);
  });

  it('shows an icon on each workspace tab', async () => {
    const fixture = await setup();
    const icons = fixture.nativeElement.querySelectorAll('[role="tab"] lucide-icon');
    expect(icons.length).toBe(5);
  });

  it('defaults to the pinyes tab', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance.activeTab()).toBe('pinyes');
  });

  it('activates the tab from the tab query param', async () => {
    const fixture = await setup({ queryParams: { tab: 'troncs' } });
    expect(fixture.componentInstance.activeTab()).toBe('troncs');
  });

  it('falls back to pinyes for an unknown tab query param', async () => {
    const fixture = await setup({ queryParams: { tab: 'nope' } });
    expect(fixture.componentInstance.activeTab()).toBe('pinyes');
  });

  describe('remembered pinyes/troncs tab', () => {
    afterEach(() => {
      localStorage.clear();
    });

    it('defaults to the last remembered pinyes/troncs tab when no tab query param is present', async () => {
      localStorage.setItem('muixer.pinyes.viewMode', 'troncs');
      const fixture = await setup();
      expect(fixture.componentInstance.activeTab()).toBe('troncs');
    });

    it('prefers the tab query param over the remembered tab', async () => {
      localStorage.setItem('muixer.pinyes.viewMode', 'troncs');
      const fixture = await setup({ queryParams: { tab: 'pinyes' } });
      expect(fixture.componentInstance.activeTab()).toBe('pinyes');
    });

    it('ignores a remembered value that is not pinyes or troncs', async () => {
      localStorage.setItem('muixer.pinyes.viewMode', 'distribucio');
      const fixture = await setup();
      expect(fixture.componentInstance.activeTab()).toBe('pinyes');
    });

    it('remembers the pinyes tab when selected via setTab', async () => {
      const fixture = await setup({ queryParams: { tab: 'troncs' } });
      fixture.componentInstance.setTab('pinyes');
      expect(localStorage.getItem('muixer.pinyes.viewMode')).toBe('pinyes');
    });

    it('remembers the troncs tab when selected via setTab', async () => {
      const fixture = await setup();
      fixture.componentInstance.setTab('troncs');
      expect(localStorage.getItem('muixer.pinyes.viewMode')).toBe('troncs');
    });

    it('does not overwrite the remembered tab when a non pinyes/troncs tab is selected', async () => {
      localStorage.setItem('muixer.pinyes.viewMode', 'pinyes');
      const fixture = await setup();
      fixture.componentInstance.setTab('distribucio');
      expect(localStorage.getItem('muixer.pinyes.viewMode')).toBe('pinyes');
    });
  });

  it('setTab updates the active tab and syncs the query param', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.setTab('distribucio');

    expect(fixture.componentInstance.activeTab()).toBe('distribucio');
    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ tab: 'distribucio' }),
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('onCrossTabSelect stashes the target ref and switches tabs (FE-BUG: "Anar-hi" onto the other tab)', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.onCrossTabSelect({ tab: 'troncs', ref: { slotId: 'inst-a', nodeId: 'n1' } });

    expect(ws.pendingSelection()).toEqual({ slotId: 'inst-a', nodeId: 'n1' });
    expect(fixture.componentInstance.activeTab()).toBe('troncs');
    localStorage.clear();
  });

  it('preselects the figure from the figure query param', async () => {
    await setup({ queryParams: { figure: 'inst-b' } });
    expect(ws.selectInstance).toHaveBeenCalledWith('inst-b');
  });

  it('preselects the figure from the legacy instanceId route param', async () => {
    await setup({ instanceIdParam: 'inst-b' });
    expect(ws.selectInstance).toHaveBeenCalledWith('inst-b');
  });

  it('selects the first instance when no figure is specified', async () => {
    await setup();
    expect(ws.selectInstance).toHaveBeenCalledWith('inst-a');
  });

  it('shows the troncs tab content when troncs is active', async () => {
    const fixture = await setup({ queryParams: { tab: 'troncs' } });
    const troncsTab = fixture.nativeElement.querySelector('app-troncs-tab');
    expect(troncsTab).toBeTruthy();
  });

  it('shows the distribucio tab content when distribucio is active', async () => {
    const fixture = await setup({ queryParams: { tab: 'distribucio' } });
    const distribucioTab = fixture.nativeElement.querySelector('app-distribucio-tab');
    expect(distribucioTab).toBeTruthy();
  });

  it('shows the nodes tab content when nodes is active', async () => {
    const fixture = await setup({ queryParams: { tab: 'nodes' } });
    const nodesTab = fixture.nativeElement.querySelector('app-nodes-tab');
    expect(nodesTab).toBeTruthy();
  });

  it('shows the previsualitza tab content when previsualitza is active', async () => {
    const fixture = await setup({ queryParams: { tab: 'previsualitza' } });
    const previsualitzaTab = fixture.nativeElement.querySelector('app-previsualitza-tab');
    expect(previsualitzaTab).toBeTruthy();
  });

  it('marks the workspace as past from the past query param', async () => {
    const fixture = await setup({ queryParams: { past: '1' } });
    expect(fixture.componentInstance.isPast()).toBe(true);
  });

  it('shows a toast and navigates back when the segment is not found', async () => {
    const backSpy = vi.spyOn(Location.prototype, 'back').mockImplementation(() => undefined);
    const fixture = await setup();

    ws.notFound.set(true);
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalled();
    expect(backSpy).toHaveBeenCalled();
    backSpy.mockRestore();
  });

  describe('prev/next segment navigation', () => {
    it('disables both arrows when there is no sibling segment', async () => {
      const fixture = await setup();
      const buttons = fixture.nativeElement.querySelectorAll(
        '[aria-label="Segment anterior"], [aria-label="Segment següent"]',
      );
      expect(Array.from(buttons).every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    });

    it('shows the segment position when available', async () => {
      const fixture = await setup();
      ws.segmentPosition.set({ current: 3, total: 7 });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('3/7');
    });

    it('enables the next arrow and navigates to the next segment on click', async () => {
      const fixture = await setup({ queryParams: { tab: 'troncs' } });
      ws.nextSegmentId.set('seg-2');
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      const nextButton = fixture.nativeElement.querySelector(
        '[aria-label="Segment següent"]',
      ) as HTMLButtonElement;
      expect(nextButton.disabled).toBe(false);
      nextButton.click();

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-2', 'assign'],
        { queryParams: { tab: 'troncs' } },
      );
    });

    it('navigates to the previous segment preserving the past and returnUrl query params', async () => {
      const fixture = await setup({ queryParams: { past: '1', returnUrl: '/rehearsals/event-123' } });
      ws.previousSegmentId.set('seg-0');
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      const prevButton = fixture.nativeElement.querySelector(
        '[aria-label="Segment anterior"]',
      ) as HTMLButtonElement;
      prevButton.click();

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/pinyes/events', EVENT_ID, 'segments', 'seg-0', 'assign'],
        { queryParams: { tab: 'pinyes', past: '1', returnUrl: '/rehearsals/event-123' } },
      );
    });

    it('reloads the workspace and resets selection when the route segmentId changes', async () => {
      await setup();
      ws.load.mockClear();
      ws.selectInstance.mockClear();

      paramMap$.next(convertToParamMap({ eventId: EVENT_ID, segmentId: 'seg-2' }));

      expect(ws.load).toHaveBeenCalledWith(EVENT_ID, 'seg-2');
      expect(ws.selectInstance).toHaveBeenCalledWith(null);
    });

    it('does not reload when the paramMap re-emits the same ids', async () => {
      await setup();
      ws.load.mockClear();

      paramMap$.next(convertToParamMap({ eventId: EVENT_ID, segmentId: SEGMENT_ID }));

      expect(ws.load).not.toHaveBeenCalled();
    });
  });

  describe('browser back button', () => {
    it('navigates to returnUrl (like the back arrow) when the browser back button is pressed', async () => {
      const fixture = await setup({ queryParams: { returnUrl: '/rehearsals/event-123' } });
      const router = TestBed.inject(Router);
      const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(navigateByUrlSpy).toHaveBeenCalledWith('/rehearsals/event-123', { replaceUrl: true });
      fixture.destroy();
    });

    it('falls back to native back navigation when there is no returnUrl', async () => {
      const backSpy = vi.spyOn(Location.prototype, 'back').mockImplementation(() => undefined);
      const fixture = await setup();

      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(backSpy).toHaveBeenCalled();
      backSpy.mockRestore();
      fixture.destroy();
    });
  });
});
