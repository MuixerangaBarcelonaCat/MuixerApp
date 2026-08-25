import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TagService } from '../../services/tag.service';
import { TagWithCount } from '../../models/tag.model';
import { PersonService } from '../../../persons/services/person.service';
import { Person } from '../../../persons/models/person.model';
import { ButtonComponent, BadgeComponent, EmptyStateComponent, ModalComponent, ToastService } from '@muixer/ui';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { DataTableComponent, RowAction } from '../../../../shared/components/data/data-table/data-table.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { PersonSearchInputComponent } from '../../../../shared/components/forms/person-search-input/person-search-input.component';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { TagFormModalComponent } from '../tag-form-modal/tag-form-modal.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import {
  TRONC_NODE_PRESETS,
  PINYA_NODE_PRESETS,
  DIRECTION_NODE_PRESETS,
  TAG_CATEGORY_LABELS,
} from '@muixer/shared';

@Component({
  selector: 'app-tag-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    TagFormModalComponent,
    DataTableComponent,
    PaginationComponent,
    PersonSearchInputComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    ModalComponent,
  ],
  templateUrl: './tag-detail.component.html',
})
export class TagDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tagService = inject(TagService);
  private readonly personService = inject(PersonService);
  private readonly toast = inject(ToastService);

  readonly ICON_TAG = DOMAIN_ICONS.TAG;
  readonly categoryLabels = TAG_CATEGORY_LABELS;

  readonly tagId = this.route.snapshot.paramMap.get('id')!;

  readonly tag = signal<TagWithCount | null>(null);
  readonly persons = signal<Person[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly confirmRemoveTarget = signal<Person | null>(null);
  readonly removing = signal(false);
  readonly tagLoadError = signal(false);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));
  readonly excludeIds = computed(() => this.persons().map((p) => p.id));

  readonly positionTypeMeta: Record<string, { label: string; color: string }> = [
    ...TRONC_NODE_PRESETS.map((p) => ({ positionType: p.positionType, label: p.label, color: p.color })),
    ...PINYA_NODE_PRESETS.map((p) => ({ positionType: p.positionType as string, label: p.label, color: p.color ?? '#64748b' })),
    ...DIRECTION_NODE_PRESETS.map((p) => ({ positionType: p.positionType as string, label: p.label, color: p.color ?? '#64748b' })),
    { positionType: 'base', label: 'Base', color: '#64748b' },
  ].reduce<Record<string, { label: string; color: string }>>((acc, p) => {
    acc[p.positionType] = { label: p.label, color: p.color };
    return acc;
  }, {});

  readonly columns: ColumnDef<Person>[] = [
    {
      key: 'person',
      label: 'Persona',
      defaultVisible: true,
      primary: true,
      value: (p) => `${p.alias} — ${p.name} ${p.firstSurname}`,
    },
  ];

  readonly rowActions: RowAction<Person>[] = [
    { label: 'Treu', icon: 'X', action: (p) => this.confirmRemove(p) },
  ];

  constructor() {
    this.loadTag();
  }

  openEditModal(): void {
    this.modalOpen.set(true);
  }

  onModalSaved(updated: TagWithCount): void {
    this.modalOpen.set(false);
    this.tag.set(updated);
  }

  onModalCancelled(): void {
    this.modalOpen.set(false);
  }

  onPersonSelected(person: Person): void {
    this.tagService.assignPersons(this.tagId, [person.id]).subscribe({
      next: () => {
        this.toast.success(`${person.alias} afegit/da a l'etiqueta.`);
        this.bumpPersonCount(1);
        this.loadPersons();
      },
      error: (err) => {
        const msg = err?.error?.message ?? "Error en afegir la persona a l'etiqueta.";
        this.toast.error(msg);
      },
    });
  }

  confirmRemove(person: Person): void {
    this.confirmRemoveTarget.set(person);
  }

  cancelRemove(): void {
    this.confirmRemoveTarget.set(null);
  }

  executeRemove(): void {
    const target = this.confirmRemoveTarget();
    if (!target || this.removing()) return;

    this.removing.set(true);
    this.tagService.unassignPerson(this.tagId, target.id).subscribe({
      next: () => {
        this.removing.set(false);
        this.confirmRemoveTarget.set(null);
        this.toast.success(`${target.alias} tret/a de l'etiqueta.`);
        this.bumpPersonCount(-1);
        this.loadPersons();
      },
      error: (err) => {
        this.removing.set(false);
        this.confirmRemoveTarget.set(null);
        const msg = err?.error?.message ?? "Error en treure la persona de l'etiqueta.";
        this.toast.error(msg);
      },
    });
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadPersons();
  }

  onLimitChange(limit: number): void {
    this.limit.set(limit);
    this.page.set(1);
    this.loadPersons();
  }

  goBack(): void {
    this.router.navigate(['/config/tags']);
  }

  private bumpPersonCount(delta: number): void {
    const tag = this.tag();
    if (tag) this.tag.set({ ...tag, personCount: tag.personCount + delta });
  }

  private loadTag(): void {
    this.tagService.getOne(this.tagId).subscribe({
      next: (tag) => {
        this.tag.set(tag);
        this.loadPersons();
      },
      error: () => {
        this.tagLoadError.set(true);
        this.toast.error("Error en carregar l'etiqueta.");
      },
    });
  }

  private loadPersons(): void {
    this.loading.set(true);
    this.personService
      .getAll({ positionIds: [this.tagId], page: this.page(), limit: this.limit() })
      .subscribe({
        next: (resp) => {
          this.persons.set(resp.data);
          this.total.set(resp.meta.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Error en carregar les persones.');
        },
      });
  }
}
