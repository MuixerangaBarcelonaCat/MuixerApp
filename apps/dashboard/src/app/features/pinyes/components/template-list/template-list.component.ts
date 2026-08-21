import { FigureTemplateListItem, FigureTemplateFilterParams } from '@muixer/pinyes-render';
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, UserCheck } from 'lucide-angular';
import { ICON_TEMPLATE, ICON_COMPOSITION, ICON_FIGURA_NETA, DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { HttpErrorResponse } from '@angular/common/http';
import { FigureTemplateService } from '../../services/figure-template.service';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';
import { ToastService } from '@muixer/ui';
import { TutorialModalComponent } from '../../../../shared/components/tutorial-modal/tutorial-modal.component';
import { TutorialStep } from '../../../../shared/components/tutorial-modal/tutorial-step.model';
import { CompositionGridTabComponent } from './composition-grid-tab/composition-grid-tab.component';

const PINYES_ONBOARDING_STORAGE_KEY = 'muixer_pinyes_onboarding_dismissed';

const PINYES_ONBOARDING_STEPS: TutorialStep[] = [
  {
    title: 'Figures',
    description:
      'Cada figura defineix totes les posicions de tots els cordons (ex: "Pinet doble de 4"). ' +
      'Les rengles defineixen les línies radials de posicions del centre cap enfora.',
    icon: DOMAIN_ICONS.FIGURA,
  },
  {
    title: 'Rengles',
    description:
      'Una rengla és la línia de posicions des del centre de la pinya cap enfora. ' +
      'Cada posició dins la rengla correspon a un cordó diferent (1r, 2n, 3r...).',
    icon: DOMAIN_ICONS.RENGLA,
  },
  {
    title: 'Assignacions',
    description:
      'Les assignacions es fan sobre una còpia de la figura (snapshot). ' +
      'Editar el template original no afecta les assignacions existents. ' +
      'Pots importar assignacions de pinyes anteriors.',
    icon: UserCheck,
  },
];

type ActiveTab = 'figures' | 'compositions';

@Component({
  selector: 'app-template-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    EmptyStateComponent,
    TutorialModalComponent,
    CompositionGridTabComponent,
  ],
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.scss',
})
export class TemplateListComponent implements OnInit {
  readonly ICON_TEMPLATE = ICON_TEMPLATE;
  readonly ICON_COMPOSITION = ICON_COMPOSITION;
  readonly ICON_FIGURA_NETA = ICON_FIGURA_NETA;
  readonly pinyesOnboardingSteps = PINYES_ONBOARDING_STEPS;
  readonly pinyesOnboardingStorageKey = PINYES_ONBOARDING_STORAGE_KEY;

  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  activeTab = signal<ActiveTab>('figures');
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  templates = signal<FigureTemplateListItem[]>([]);
  total = signal(0);
  page = signal(1);
  limit = signal(25);
  loading = signal(false);
  search = signal('');
  searchInput = '';
  deletingId = signal<string | null>(null);
  confirmDeleteId = signal<string | null>(null);
  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit()));

  ngOnInit() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as ActiveTab | null;
    if (tab === 'compositions') {
      this.activeTab.set('compositions');
    } else {
      this.loadTemplates();
    }
  }

  setTab(tab: ActiveTab) {
    this.activeTab.set(tab);
    if (tab === 'figures' && this.templates().length === 0) {
      this.loadTemplates();
    }
  }

  onSearchChange(value: string) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.page.set(1);
      this.loadTemplates();
    }, 300);
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadTemplates();
  }

  navigateToCreate() {
    this.router.navigate(['/pinyes/templates/new']);
  }

  navigateToEdit(id: string) {
    this.router.navigate(['/pinyes/templates', id, 'edit']);
  }

  requestDelete(id: string) {
    this.confirmDeleteId.set(id);
  }

  cancelDelete() {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(id: string) {
    this.confirmDeleteId.set(null);
    this.deletingId.set(id);
    this.figureTemplateService.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.loadTemplates();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
        const msg = err.error?.message as string | undefined;
        if (err.status === 409) {
          this.toast.error(msg ?? 'No es pot esborrar: hi ha instàncies que fan servir aquesta figura.');
        } else {
          this.toast.error('No s\'ha pogut eliminar la figura.');
        }
      },
    });
  }

  duplicate(id: string) {
    this.loading.set(true);
    this.figureTemplateService.duplicate(id).subscribe({
      next: (copy) => {
        this.loading.set(false);
        this.router.navigate(['/pinyes/templates', copy.id, 'edit']);
      },
      error: () => this.loading.set(false),
    });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private loadTemplates() {
    this.loading.set(true);
    const filters: FigureTemplateFilterParams = {
      search: this.search() || undefined,
      page: this.page(),
      limit: this.limit(),
    };
    this.figureTemplateService.getAll(filters).subscribe({
      next: (resp) => {
        this.templates.set(resp.data);
        this.total.set(resp.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
