import { Component, WritableSignal, input, output, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { LucideAngularModule } from 'lucide-angular';
import type { BulkImportResult } from '@muixer/pinyes-render';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { SegmentWorkspaceComponent } from './segment-workspace.component';
import { SegmentWorkspaceStateService, WorkspaceInstance } from '../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { UndoRedoService } from '../../services/undo-redo.service';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService, TabsComponent, ButtonComponent, BadgeComponent, ModalComponent } from '@muixer/ui';
import { TemplateEditorHelpModalComponent } from '../template-editor-help-modal/template-editor-help-modal.component';

@Component({ selector: 'app-import-pinya-modal', standalone: true, template: '' })
class StubImportModal {
  readonly figureTemplateId = input.required<string>();
  readonly currentInstanceId = input.required<string>();
  readonly origin = input<'pinya' | 'tronc'>('pinya');
  readonly open = input<boolean>(false);
  readonly importCompleted = output<BulkImportResult>();
  readonly closed = output<void>();
}

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

@Component({ selector: 'app-segment-conflict-panel', standalone: true, template: '' })
class StubSegmentConflictPanel {}

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

type MockFn = ReturnType<typeof vi.fn>;

describe('SegmentWorkspaceComponent', () => {
  let ws: WsMock;
  let layoutService: {
    requestFullscreen: ReturnType<typeof vi.fn>;
    exitFullscreen: ReturnType<typeof vi.fn>;
    isTouch: WritableSignal<boolean>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let assignmentService: { resetSnapshot: MockFn };
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  // `FiguresViewModeService` (@muixer/pinyes remembered tab) reads real jsdom `localStorage` at
  // construction — it can leak a value across specs (this file's own, or another file sharing a
  // worker) and make an unrelated test's `else` branch flaky. Guarantee a clean slate.
  beforeEach(() => localStorage.clear());

  const setup = async (
    opts: { queryParams?: Record<string, string>; instanceIdParam?: string; touch?: boolean } = {},
  ) => {
    ws = makeWsMock();
    layoutService = {
      requestFullscreen: vi.fn(),
      exitFullscreen: vi.fn(),
      isTouch: signal(opts.touch ?? false),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    assignmentService = { resetSnapshot: vi.fn() };

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
        { provide: NodeAssignmentService, useValue: assignmentService },
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
          ButtonComponent,
          BadgeComponent,
          ModalComponent,
          TabsComponent,
          StubPinyesTab,
          StubTroncsTab,
          StubDistribucioTab,
          StubNodesTab,
          StubPrevisualitzaTab,
          StubSegmentConflictPanel,
          TemplateEditorHelpModalComponent,
          StubImportModal,
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

  it('lets the tab bar scroll horizontally instead of cutting off tabs on mobile (WI-12, P-M1)', async () => {
    const fixture = await setup();
    const nav = fixture.nativeElement.querySelector('nav[role="tablist"]') as HTMLElement;
    expect(nav.className).toContain('overflow-x-auto');
    expect(nav.className).toContain('flex-nowrap');
    expect(nav.className).toContain('min-w-0');
  });

  it('keeps the prev/next segment controls from shrinking so the tab bar is what scrolls', async () => {
    const fixture = await setup();
    const header = fixture.nativeElement.querySelector('header') as HTMLElement;
    const prevNextGroup = header.querySelector('.shrink-0.sm\\:ml-2') as HTMLElement;
    expect(prevNextGroup).toBeTruthy();
    expect(prevNextGroup.className).toContain('shrink-0');
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

  describe('touch devices (phones / tablets)', () => {
    it('shows only the pinyes and troncs tabs', async () => {
      const fixture = await setup({ touch: true });

      expect(tabLabels(fixture)).toEqual(['Pinyes', 'Troncs']);
    });

    it('still shows all five tabs on a non-touch device', async () => {
      const fixture = await setup({ touch: false });

      expect(tabLabels(fixture)).toHaveLength(5);
    });

    it('falls back to the remembered pinyes/troncs tab when the tab query param is not available on touch', async () => {
      localStorage.setItem('muixer.pinyes.viewMode', 'troncs');

      const fixture = await setup({ touch: true, queryParams: { tab: 'distribucio' } });

      expect(fixture.componentInstance.activeTab()).toBe('troncs');
    });

    it('falls back to pinyes when nothing is remembered', async () => {
      const fixture = await setup({ touch: true, queryParams: { tab: 'previsualitza' } });

      expect(fixture.componentInstance.activeTab()).toBe('pinyes');
    });

    it('keeps a pinyes/troncs tab query param on touch', async () => {
      const fixture = await setup({ touch: true, queryParams: { tab: 'troncs' } });

      expect(fixture.componentInstance.activeTab()).toBe('troncs');
    });

    it('leaves the hidden tab when the device becomes touch while it is open', async () => {
      const fixture = await setup({ touch: false, queryParams: { tab: 'nodes' } });
      expect(fixture.componentInstance.activeTab()).toBe('nodes');

      layoutService.isTouch.set(true);
      fixture.detectChanges();

      expect(fixture.componentInstance.activeTab()).toBe('pinyes');
      expect(tabLabels(fixture)).toEqual(['Pinyes', 'Troncs']);
    });

    it('shows the pinyes tab content instead of a hidden tab', async () => {
      const fixture = await setup({ touch: true, queryParams: { tab: 'nodes' } });

      expect(fixture.nativeElement.querySelector('app-pinyes-tab')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-nodes-tab')).toBeNull();
    });
  });

  it('collapses the inactive tabs to their icon on phones, keeping the active tab labelled', async () => {
    const fixture = await setup({ queryParams: { tab: 'troncs' } });
    const labels = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"] span')) as HTMLElement[];

    const byText = (text: string) => labels.find((el) => (el.textContent ?? '').trim() === text) as HTMLElement;
    expect(byText('Troncs').classList).not.toContain('max-sm:sr-only');
    expect(byText('Pinyes').classList).toContain('max-sm:sr-only');
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

  describe('segment title width', () => {
    const titleClasses = async (name: string | null = 'Bloc 1'): Promise<string[]> => {
      const fixture = await setup();
      ws.segmentName.set(name);
      fixture.detectChanges();
      const title = fixture.nativeElement.querySelector('h1') as HTMLElement;
      return title.className.split(/\s+/);
    };

    it('takes a fixed sixth of the header at every screen size (never content-sized)', async () => {
      const classes = await titleClasses();

      expect(classes).toContain('w-1/6');
      expect(classes.filter((c) => /^(sm:|md:|lg:|xl:|2xl:)w-/.test(c))).toEqual([]);
      expect(classes).toContain('shrink-0');
    });

    it('truncates long titles instead of growing', async () => {
      const classes = await titleClasses('Un nom de segment molt però que molt llarg');

      expect(classes).toContain('truncate');
    });

    it('never sizes itself from its content', async () => {
      const classes = await titleClasses();
      const contentSized = /^(sm:|md:|lg:)?(w-auto|w-fit|w-max|w-min|flex-1|flex-auto|grow|min-w-.+|max-w-.+)$/;

      expect(classes.filter((c) => contentSized.test(c))).toEqual([]);
    });
  });

  describe('header controls hidden on phones (below `sm`), kept on tablets and up', () => {
    const header = (f: ComponentFixture<SegmentWorkspaceComponent>) =>
      f.nativeElement.querySelector('header') as HTMLElement;
    const button = (f: ComponentFixture<SegmentWorkspaceComponent>, label: string) =>
      header(f).querySelector(`button[aria-label="${label}"]`) as HTMLElement;

    it('hides the "n/total" segment counter between the arrows', async () => {
      const fixture = await setup();
      ws.segmentPosition.set({ current: 2, total: 11 });
      fixture.detectChanges();

      const counter = Array.from(header(fixture).querySelectorAll('span')).find((el) =>
        (el.textContent ?? '').includes('2/11'),
      ) as HTMLElement;
      expect(counter.classList).toContain('hidden');
      expect(counter.classList).toContain('sm:inline');
    });

    it('hides the help button', async () => {
      const fixture = await setup();

      const wrapper = button(fixture, "Ajuda de l'assignació").closest('.hidden') as HTMLElement;
      expect(wrapper).toBeTruthy();
      expect(wrapper.classList).toContain('sm:block');
    });

    it('hides the import button', async () => {
      const fixture = await setup();

      const wrapper = button(fixture, "Importa les assignacions d'una figura anterior").closest(
        '.hidden',
      ) as HTMLElement;
      expect(wrapper).toBeTruthy();
      expect(wrapper.classList).toContain('sm:flex');
    });

    it('hides the reset button', async () => {
      const fixture = await setup();
      ws.instances.set([{ ...makeWorkspaceInstance('inst-a'), snapshotted: true }]);
      fixture.detectChanges();

      const wrapper = button(
        fixture,
        'Reinicialitza una figura: elimina totes les assignacions i torna a la plantilla original',
      ).closest('.hidden') as HTMLElement;
      expect(wrapper).toBeTruthy();
      expect(wrapper.classList).toContain('sm:flex');
    });

    it('keeps the back and prev/next arrows visible', async () => {
      const fixture = await setup();

      for (const label of ['Torna arrere', 'Segment anterior', 'Segment següent']) {
        expect(button(fixture, label).closest('.hidden')).toBeNull();
      }
    });
  });

  it('tightens the header spacing on phones so the controls fit', async () => {
    const fixture = await setup();
    const header = fixture.nativeElement.querySelector('header') as HTMLElement;

    expect(header.className).toContain('gap-2');
    expect(header.className).toContain('sm:gap-3');
    expect(header.className).toContain('px-2');
    expect(header.className).toContain('sm:px-4');
  });

  // Scoped to the header's own trigger buttons — the always-rendered figure-picker/confirm
  // lib-modals also carry this text in their (closed) title/body, so a plain textContent
  // check would false-negative on those instead of the trigger.
  const headerTriggerText = (fixture: ComponentFixture<SegmentWorkspaceComponent>): string =>
    (fixture.nativeElement.querySelector('header') as HTMLElement).textContent ?? '';

  describe('import pinya / reset snapshot (moved here from the pinyes tab footer)', () => {
    it('shows neither button when there is nothing to import/reset', async () => {
      const fixture = await setup();
      ws.instances.set([]);
      fixture.detectChanges();
      expect(headerTriggerText(fixture)).not.toContain('Reinicialitza');
      expect(headerTriggerText(fixture)).not.toContain('Importa pinya');
    });

    it('hides both buttons on tabs other than pinyes/troncs', async () => {
      const fixture = await setup({ queryParams: { tab: 'distribucio' } });
      expect(headerTriggerText(fixture)).not.toContain('Reinicialitza');
      expect(headerTriggerText(fixture)).not.toContain('Importa');
    });

    it('shows the import button (never reset) on the troncs tab, labelled "Importa tronc"', async () => {
      const fixture = await setup({ queryParams: { tab: 'troncs' } });
      ws.instances.set([{ ...makeWorkspaceInstance('inst-a'), snapshotted: true }]);
      fixture.detectChanges();
      expect(headerTriggerText(fixture)).toContain('Importa tronc');
      expect(headerTriggerText(fixture)).not.toContain('Reinicialitza');
    });

    it('passes origin "tronc" to the import target when triggered from the troncs tab', async () => {
      const fixture = await setup({ queryParams: { tab: 'troncs' } });
      ws.instances.set([makeWorkspaceInstance('inst-a')]);
      fixture.detectChanges();

      fixture.componentInstance.openImport();

      expect(fixture.componentInstance.importTarget()).toEqual({
        instanceId: 'inst-a',
        figureTemplateId: 'tpl-inst-a',
        origin: 'tronc',
      });
    });

    it('shows the import button when there is a figure to import into', async () => {
      const fixture = await setup();
      expect(fixture.nativeElement.textContent).toContain('Importa pinya');
    });

    it('opens the import modal directly when the segment has a single figure', async () => {
      const fixture = await setup();
      ws.instances.set([makeWorkspaceInstance('inst-a')]);
      fixture.detectChanges();

      fixture.componentInstance.openImport();

      expect(fixture.componentInstance.importTarget()).toEqual({
        instanceId: 'inst-a',
        figureTemplateId: 'tpl-inst-a',
        origin: 'pinya',
      });
      expect(fixture.componentInstance.importMenuOpen()).toBe(false);
    });

    it('opens a figure menu first when several figures can be imported into', async () => {
      const fixture = await setup();

      fixture.componentInstance.openImport();
      expect(fixture.componentInstance.importMenuOpen()).toBe(true);
      expect(fixture.componentInstance.importTarget()).toBeNull();

      fixture.componentInstance.chooseImportFigure('inst-b');
      expect(fixture.componentInstance.importTarget()).toEqual({
        instanceId: 'inst-b',
        figureTemplateId: 'tpl-inst-b',
        origin: 'pinya',
      });
      expect(fixture.componentInstance.importMenuOpen()).toBe(false);
    });

    it('refreshes the target instance and closes the modal when an import completes', async () => {
      const fixture = await setup();
      ws.instances.set([makeWorkspaceInstance('inst-a')]);
      fixture.detectChanges();
      fixture.componentInstance.openImport();

      fixture.componentInstance.onImportCompleted({
        created: [],
        conflicts: [],
        clonedAdHocNodes: 0,
        conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
      });

      expect(ws.refreshInstance).toHaveBeenCalledWith('inst-a');
      expect(toast.success).toHaveBeenCalled();
      expect(fixture.componentInstance.importTarget()).toBeNull();
    });

    it('shows no reset button when nothing is snapshotted', async () => {
      const fixture = await setup();
      expect(headerTriggerText(fixture)).not.toContain('Reinicialitza');
    });

    it('opens the reset confirmation directly with a single snapshotted figure', async () => {
      const fixture = await setup();
      ws.instances.set([{ ...makeWorkspaceInstance('inst-a'), snapshotted: true }]);
      fixture.detectChanges();

      fixture.componentInstance.openReset();

      expect(fixture.componentInstance.resetTarget()).toBe('inst-a');
    });

    it('opens a figure menu first when several figures are snapshotted', async () => {
      const fixture = await setup();
      ws.instances.set([
        { ...makeWorkspaceInstance('inst-a'), snapshotted: true },
        { ...makeWorkspaceInstance('inst-b'), snapshotted: true },
      ]);
      fixture.detectChanges();

      fixture.componentInstance.openReset();
      expect(fixture.componentInstance.resetMenuOpen()).toBe(true);
      expect(fixture.componentInstance.resetTarget()).toBeNull();

      fixture.componentInstance.chooseResetFigure('inst-b');
      expect(fixture.componentInstance.resetTarget()).toBe('inst-b');
    });

    it('resets the figure and clears its assignments on confirm', async () => {
      const fixture = await setup();
      ws.instances.set([{ ...makeWorkspaceInstance('inst-a'), snapshotted: true }]);
      fixture.detectChanges();
      const state = TestBed.inject(AssignmentStateService);
      state.assignments.set([
        {
          id: 'as-1',
          figureInstanceId: 'inst-a',
          node: { id: 'n1', label: 'n1', zone: 'PINYA', z: 0, positionType: null, sortOrder: 0, climbIndicator: null, ringLevel: null, originNodeId: null, sourceNodeId: null },
          person: { id: 'p-1', alias: 'Alias', name: 'Nom', firstSurname: 'Cognom', shoulderHeight: null, notes: null, notesEmoji: null },
        },
      ]);
      assignmentService.resetSnapshot.mockReturnValue(of({ removedAssignments: 1, deletedAdHocCount: 0 }));

      fixture.componentInstance.openReset();
      fixture.componentInstance.confirmReset();

      expect(assignmentService.resetSnapshot).toHaveBeenCalledWith('inst-a');
      expect(state.assignments()).toHaveLength(0);
      expect(toast.success).toHaveBeenCalled();
      expect(fixture.componentInstance.resetTarget()).toBeNull();
    });
  });
});
