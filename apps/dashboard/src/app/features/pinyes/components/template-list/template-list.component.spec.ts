import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS, LucideIconProvider,
  Plus, Search, Layers, LayoutGrid,
  Pencil, Trash2, X, HelpCircle,
  Plus as PlusIcon, Circle, Rows3, SearchX,
} from 'lucide-angular';
import { TemplateListComponent } from './template-list.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';

describe('TemplateListComponent (shell)', () => {
  let fixture: ComponentFixture<TemplateListComponent>;
  let component: TemplateListComponent;
  let queryParamGet: ReturnType<typeof vi.fn>;

  const buildProviders = () => [
    { provide: Router, useValue: { navigate: vi.fn() } },
    {
      provide: ActivatedRoute,
      useValue: { snapshot: { queryParamMap: { get: queryParamGet } } },
    },
    {
      provide: FigureTemplateService,
      useValue: { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 25 } })) },
    },
    {
      provide: CompositionTemplateService,
      useValue: { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 25 } })) },
    },
    { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
    {
      provide: LUCIDE_ICONS, multi: true,
      useFactory: () => new LucideIconProvider({
        Plus: PlusIcon, Search, Layers, LayoutGrid,
        Pencil, Trash2, X, HelpCircle, Circle, Rows3, SearchX,
      }),
    },
  ];

  beforeEach(async () => {
    queryParamGet = vi.fn().mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [TemplateListComponent],
      providers: buildProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to figures tab', () => {
    expect(component.activeTab()).toBe('figures');
  });

  it('setTab updates the active tab signal', () => {
    component.setTab('compositions');
    expect(component.activeTab()).toBe('compositions');

    component.setTab('figures');
    expect(component.activeTab()).toBe('figures');
  });

  it('reads "tab" query param on init (compositions)', async () => {
    queryParamGet.mockReturnValue('compositions');

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TemplateListComponent],
      providers: buildProviders(),
    }).compileComponents();

    const f2 = TestBed.createComponent(TemplateListComponent);
    f2.detectChanges();
    expect(f2.componentInstance.activeTab()).toBe('compositions');
  });
});
