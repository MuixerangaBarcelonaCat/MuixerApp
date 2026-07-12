import { Component, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
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
  nodes: [],
  assignedCount: 0,
  totalCount: 0,
});

type WsMock = ReturnType<typeof makeWsMock>;

const makeWsMock = () => ({
  eventId: signal(''),
  segmentId: signal(''),
  loading: signal(false),
  notFound: signal(false),
  segment: signal(null),
  segmentName: signal<string | null>('Bloc 1'),
  instances: signal<WorkspaceInstance[]>([makeWorkspaceInstance('inst-a'), makeWorkspaceInstance('inst-b')]),
  distributionByInstance: signal(new Map()),
  selectedInstanceId: signal<string | null>(null),
  selectedInstance: signal<WorkspaceInstance | null>(null),
  lockStatus: signal(null),
  isLocked: signal(false),
  personsLoaded: signal(true),
  pinyaSlots: signal([]),
  load: vi.fn(),
  refreshInstance: vi.fn(),
  selectInstance: vi.fn(),
  visibleNodesFor: vi.fn().mockReturnValue([]),
});

describe('SegmentWorkspaceComponent', () => {
  let ws: WsMock;
  let layoutService: { requestFullscreen: ReturnType<typeof vi.fn>; exitFullscreen: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  const setup = async (opts: { queryParams?: Record<string, string>; instanceIdParam?: string } = {}) => {
    ws = makeWsMock();
    layoutService = { requestFullscreen: vi.fn(), exitFullscreen: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    const params: Record<string, string> = { eventId: EVENT_ID, segmentId: SEGMENT_ID };
    if (opts.instanceIdParam) params['instanceId'] = opts.instanceIdParam;
    const queryParams = opts.queryParams ?? {};

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
