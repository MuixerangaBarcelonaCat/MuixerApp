import { FigureTemplateListItem } from '@muixer/pinyes-render';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { TemplateListComponent } from './template-list.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { ToastService, ModalComponent, TabsComponent, InputComponent, CardComponent, ButtonComponent, BadgeComponent } from '@muixer/ui';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { TemplatePreviewDrawingComponent } from '../template-preview-drawing/template-preview-drawing.component';

const makeTemplate = (overrides: Partial<FigureTemplateListItem> = {}): FigureTemplateListItem => ({
  id: 'tmpl-1',
  name: 'pd4 1C',
  slug: 'pd4-1c',
  description: null,
  hasPinya: true,
  direction: 0,
  nodeCount: 10,
  renglaCount: 0,
  troncProfile: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('TemplateListComponent', () => {
  let fixture: ComponentFixture<TemplateListComponent>;
  let component: TemplateListComponent;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let figureService: {
    getAll: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    duplicate: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let toastService: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  const paginatedTemplates = { data: [makeTemplate()], meta: { total: 1, page: 1, limit: 25 } };

  beforeEach(async () => {
    router = { navigate: vi.fn() };
    figureService = {
      getAll: vi.fn().mockReturnValue(of(paginatedTemplates)),
      getOne: vi.fn().mockReturnValue(of({ ...makeTemplate(), nodes: [] })),
      remove: vi.fn().mockReturnValue(of(undefined)),
      duplicate: vi.fn().mockReturnValue(of(makeTemplate({ id: 'dup-1' }))),
      create: vi.fn().mockReturnValue(of(makeTemplate({ id: 'new-1' }))),
    };
    toastService = { error: vi.fn(), success: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TemplateListComponent],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: vi.fn().mockReturnValue(null) } } },
        },
        { provide: FigureTemplateService, useValue: figureService },
        { provide: ToastService, useValue: toastService },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to figures tab and loads templates on init', () => {
    expect(component.activeTab()).toBe('figures');
    expect(figureService.getAll).toHaveBeenCalled();
  });

  it('populates templates after load', () => {
    expect(component.templates()).toHaveLength(1);
    expect(component.templates()[0].name).toBe('pd4 1C');
  });

  it('navigateToCreate navigates to new template editor', () => {
    component.navigateToCreate();
    expect(router.navigate).toHaveBeenCalledWith(['/pinyes/templates/new']);
  });

  it('setTab("compositions") switches tab without loading from service', () => {
    component.setTab('compositions');
    expect(component.activeTab()).toBe('compositions');
  });

  // ── Pagination ─────────────────────────────────────────────────────────

  describe('pagination total', () => {
    it('uses meta.total instead of data.length', () => {
      figureService.getAll.mockReturnValue(
        of({ data: [makeTemplate()], meta: { total: 50, page: 1, limit: 25 } }),
      );
      component.ngOnInit();
      expect(component.total()).toBe(50);
      expect(component.totalPages()).toBe(2);
    });
  });

  // ── Badge "Figura neta" rendering ──────────────────────────────────────

  describe('badge Figura neta', () => {
    it('renders badge-info "Figura neta" for figures with hasPinya=false', () => {
      figureService.getAll.mockReturnValue(
        of({
          data: [makeTemplate({ id: 'neta-1', name: 'Piló', hasPinya: false })],
          meta: { total: 1, page: 1, limit: 25 },
        }),
      );
      component.ngOnInit();
      fixture.detectChanges();
      const badges = fixture.nativeElement.querySelectorAll('.badge-info');
      expect(badges.length).toBe(1);
      expect(badges[0].textContent.trim()).toBe('Figura neta');
    });

    it('does NOT render badge-info for figures with hasPinya=true', () => {
      fixture.detectChanges();
      const badges = fixture.nativeElement.querySelectorAll('.badge-info');
      expect(badges.length).toBe(0);
    });
  });

  // ── Preview drawing ────────────────────────────────────────────────────

  describe('template preview drawing', () => {
    it('draws each figure\'s troncProfile, seeded by its name', () => {
      figureService.getAll.mockReturnValue(
        of({
          data: [makeTemplate({ name: 'Alta clàssica', troncProfile: [4, 4, 2, 1, 1] })],
          meta: { total: 1, page: 1, limit: 25 },
        }),
      );
      component.ngOnInit();
      fixture.detectChanges();

      const drawing = fixture.debugElement.query(By.directive(TemplatePreviewDrawingComponent))
        ?.componentInstance as TemplatePreviewDrawingComponent;
      expect(drawing).toBeTruthy();
      expect(drawing.profiles()).toEqual([[4, 4, 2, 1, 1]]);
      expect(drawing.seedKey()).toBe('Alta clàssica');
    });

    it('passes hasPinya through to the drawing, so the pinya cue matches the badge', () => {
      figureService.getAll.mockReturnValue(
        of({
          data: [
            makeTemplate({ id: 'a', name: 'Amb pinya', hasPinya: true }),
            makeTemplate({ id: 'b', name: 'Neta', hasPinya: false }),
          ],
          meta: { total: 2, page: 1, limit: 25 },
        }),
      );
      component.ngOnInit();
      fixture.detectChanges();

      const drawings = fixture.debugElement
        .queryAll(By.directive(TemplatePreviewDrawingComponent))
        .map((el) => el.componentInstance as TemplatePreviewDrawingComponent);
      expect(drawings.find((d) => d.seedKey() === 'Amb pinya')?.hasPinya()).toBe(true);
      expect(drawings.find((d) => d.seedKey() === 'Neta')?.hasPinya()).toBe(false);
    });

    it('no longer renders the old decorative gradient panel', () => {
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.bg-gradient-to-br')).toBeFalsy();
    });
  });

  // ── Design-system primitives ────────────────────────────────────────────

  describe('design-system primitives', () => {
    it('gives the page title a serif display treatment', () => {
      const h1: HTMLElement = fixture.nativeElement.querySelector('h1');
      expect(h1.classList.contains('font-serif')).toBe(true);
    });

    it('drives the figures/compositions switch via lib-tabs', () => {
      const tabs = fixture.debugElement.query(By.directive(TabsComponent))
        ?.componentInstance as TabsComponent;
      expect(tabs).toBeTruthy();
      expect(tabs.activeId()).toBe('figures');
    });

    it('switches tabs when lib-tabs emits activeIdChange', () => {
      const tabs = fixture.debugElement.query(By.directive(TabsComponent))
        ?.componentInstance as TabsComponent;
      tabs.activeIdChange.emit('compositions');
      expect(component.activeTab()).toBe('compositions');
    });

    it('the search field is a lib-input', () => {
      const input = fixture.debugElement.query(By.directive(InputComponent));
      expect(input).toBeTruthy();
    });

    it('uses app-page-header for the title, with no separate subtitle line', () => {
      const header = fixture.debugElement.query(By.directive(PageHeaderComponent))
        ?.componentInstance as PageHeaderComponent;
      expect(header).toBeTruthy();
      expect(header.title()).toBe('Plantilles');
      expect(fixture.nativeElement.textContent).not.toContain(
        'Plantilles i composicions per dissenyar i assignar pinyes',
      );
    });

    it('places "Figura nova" next to the search field, not in the page header', () => {
      const headerEl: HTMLElement = fixture.debugElement.query(By.directive(PageHeaderComponent)).nativeElement;
      expect(headerEl.textContent).not.toContain('Figura nova');

      const button = fixture.debugElement
        .queryAll(By.directive(ButtonComponent))
        .find((el) => el.nativeElement.textContent.includes('Figura nova'));
      expect(button).toBeTruthy();
    });

    it('renders each figure inside a lib-card with a title sash bearing its name, no icon', () => {
      const card = fixture.debugElement.query(By.directive(CardComponent))
        ?.componentInstance as CardComponent;
      expect(card).toBeTruthy();
      expect(card.sash()).toBe('title');
      expect(card.title()).toBe('pd4 1C');
      expect(card.icon()).toBeUndefined();
    });

    it('keeps the node-count and "Figura neta" indicators on one shared row, so a neta card is not taller than a regular one', () => {
      figureService.getAll.mockReturnValue(
        of({
          data: [makeTemplate({ id: 'neta-1', name: 'Piló', hasPinya: false })],
          meta: { total: 1, page: 1, limit: 25 },
        }),
      );
      component.ngOnInit();
      fixture.detectChanges();

      // lib-badge's host is display:contents — still a real DOM node, so compare the <lib-badge>
      // hosts' own parent, not the inner <span>'s (whose parentElement is the host itself).
      const badges: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.badge'));
      const nodesBadgeHost = badges
        .find((el) => el.textContent?.includes('nodes'))
        ?.closest('lib-badge') as HTMLElement;
      const netaBadgeHost: HTMLElement = fixture.nativeElement
        .querySelector('.badge-info')
        ?.closest('lib-badge');
      expect(nodesBadgeHost).toBeTruthy();
      expect(netaBadgeHost).toBeTruthy();
      expect(nodesBadgeHost.parentElement).toBe(netaBadgeHost.parentElement);
    });

    it('gives the preview drawing the same background as the rest of the card', () => {
      const previewButton: HTMLElement = fixture.nativeElement.querySelector('button[aria-label^="Edita"]');
      expect(previewButton.className).not.toContain('bg-base-200');
    });

    it('gives "Figura neta" the same badge size as the node-count badge', () => {
      figureService.getAll.mockReturnValue(
        of({
          data: [makeTemplate({ id: 'neta-1', name: 'Piló', hasPinya: false })],
          meta: { total: 1, page: 1, limit: 25 },
        }),
      );
      component.ngOnInit();
      fixture.detectChanges();

      const badges = fixture.debugElement.queryAll(By.directive(BadgeComponent));
      const nodesBadge = badges
        .map((el) => el.componentInstance as BadgeComponent)
        .find((b) => b.variant() === 'primary');
      const netaBadge = badges
        .map((el) => el.componentInstance as BadgeComponent)
        .find((b) => b.variant() === 'info');
      expect(nodesBadge?.size()).toBe(netaBadge?.size());
    });

    it('gives the search field real, visible room instead of shrinking to fit content', () => {
      const wrapper: HTMLElement | null = fixture.nativeElement.querySelector('lib-input')?.parentElement;
      expect(wrapper?.className).toContain('flex-1');
    });

    it('no longer darkens the preview drawing on hover, independent of the rest of the card', () => {
      const previewButton: HTMLElement | null = fixture.nativeElement.querySelector(
        'button[aria-label^="Edita"]',
      );
      expect(previewButton?.className).not.toContain('brightness');
    });
  });

  // ── Delete confirmation ──────────────────────────────────────────────────

  describe('delete confirmation', () => {
    it('opens a lib-modal (not an inline row swap) when requestDelete is called', () => {
      component.requestDelete('tmpl-1');
      fixture.detectChanges();
      const modal = fixture.debugElement.query(By.directive(ModalComponent))
        ?.componentInstance as ModalComponent;
      expect(modal.open()).toBe(true);
    });

    it('closes the modal on cancelDelete', () => {
      component.requestDelete('tmpl-1');
      component.cancelDelete();
      fixture.detectChanges();
      const modal = fixture.debugElement.query(By.directive(ModalComponent))
        ?.componentInstance as ModalComponent;
      expect(modal.open()).toBe(false);
    });
  });

  // ── Duplicate (per-row loading, independent of the page's own loading flag) ─

  describe('duplicate', () => {
    it('tracks in-progress duplication via duplicatingId, not the shared page loading flag', () => {
      const subject = new Subject<FigureTemplateListItem>();
      figureService.duplicate.mockReturnValue(subject);

      component.duplicate('tmpl-1');
      expect(component.duplicatingId()).toBe('tmpl-1');
      expect(component.loading()).toBe(false);

      subject.next(makeTemplate({ id: 'dup-1' }));
      subject.complete();
      expect(component.duplicatingId()).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/pinyes/templates', 'dup-1', 'edit']);
    });

    it('clears duplicatingId if the duplicate call errors', () => {
      const subject = new Subject<FigureTemplateListItem>();
      figureService.duplicate.mockReturnValue(subject);

      component.duplicate('tmpl-1');
      subject.error(new Error('boom'));
      expect(component.duplicatingId()).toBeNull();
    });
  });

  describe('card action row width', () => {
    it('keeps Duplica/Elimina icon-only (no visible label) so 3 actions always fit the card', () => {
      const duplica: HTMLElement = fixture.nativeElement.querySelector(
        'button[aria-label^="Duplica"]',
      );
      const elimina: HTMLElement = fixture.nativeElement.querySelector(
        'button[aria-label^="Elimina"]',
      );
      expect(duplica.textContent?.trim()).toBe('');
      expect(elimina.textContent?.trim()).toBe('');
    });

    it('keeps Edita\'s visible text label always, even at the narrowest card width', () => {
      const edits = fixture.nativeElement.querySelectorAll('button[aria-label^="Edita"]');
      const editAction = Array.from(edits).find((el) =>
        (el as HTMLElement).textContent?.includes('Edita'),
      ) as HTMLElement;
      expect(editAction).toBeTruthy();
    });
  });
});
