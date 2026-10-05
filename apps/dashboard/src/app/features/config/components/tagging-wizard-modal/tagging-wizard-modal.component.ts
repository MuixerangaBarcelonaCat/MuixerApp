import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subscription, forkJoin, map, of, switchMap } from 'rxjs';
import { ExternalLink, LucideAngularModule, Search } from 'lucide-angular';
import { TAG_CATEGORY_LABELS, TagCategory } from '@muixer/shared';
import {
  BadgeComponent,
  ButtonComponent,
  EmptyStateComponent,
  InputComponent,
  ModalComponent,
  TabDef,
  TabsComponent,
  ToastService,
} from '@muixer/ui';
import { PersonService } from '../../../persons/services/person.service';
import { Person, PersonFilterParams, Position } from '../../../persons/models/person.model';
import { TagService } from '../../services/tag.service';
import { TagWithCount } from '../../models/tag.model';
import { TaggingMode, advance, isTagCompliant } from './tagging-queue.util';

const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;
const CATEGORY_ORDER: TagCategory[] = [TagCategory.PINYA, TagCategory.TRONC, TagCategory.XICALLA, TagCategory.ALTRES];

const toPosition = (tag: TagWithCount): Position => ({
  id: tag.id,
  name: tag.name,
  slug: tag.slug,
  zone: null,
  color: tag.color ?? '',
  category: tag.category,
});

/** Modal que recorre persones per assignar-los etiquetes sense eixir de la pantalla d'etiquetes. */
@Component({
  selector: 'app-tagging-wizard-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    ModalComponent,
    ButtonComponent,
    BadgeComponent,
    InputComponent,
    TabsComponent,
    EmptyStateComponent,
  ],
  templateUrl: './tagging-wizard-modal.component.html',
})
export class TaggingWizardModalComponent {
  private readonly personService = inject(PersonService);
  private readonly tagService = inject(TagService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly closed = output<void>();

  readonly SearchIcon = Search;
  readonly ExternalLinkIcon = ExternalLink;
  readonly modeTabs: TabDef[] = [
    { id: 'pending', label: 'Pendents' },
    { id: 'all', label: 'Tothom' },
  ];

  readonly mode = signal<TaggingMode>('pending');
  readonly people = signal<Person[]>([]);
  readonly index = signal(0);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly tags = signal<TagWithCount[]>([]);
  private readonly inFlight = signal<ReadonlySet<string>>(new Set());
  private readonly search = signal('');
  searchInput = '';

  readonly current = computed(() => this.people()[this.index()] ?? null);
  readonly canNext = computed(() => {
    const person = this.current();
    if (!person) return false;
    if (this.index() < this.people().length - 1) return true;
    return this.mode() === 'pending' && isTagCompliant(person);
  });
  readonly groups = computed(() =>
    CATEGORY_ORDER.map((category) => ({
      category,
      label: TAG_CATEGORY_LABELS[category],
      tags: this.tags().filter((t) => t.category === category),
    })).filter((g) => g.tags.length > 0),
  );

  private loadSub?: Subscription;
  private searchTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.loadSub?.unsubscribe();
      clearTimeout(this.searchTimeout);
    });
    this.tagService.getAll().subscribe({
      next: (tags) => this.tags.set(tags),
      error: () => this.toast.error("No s'han pogut carregar les etiquetes."),
    });
    this.reload();
  }

  setMode(mode: TaggingMode): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    this.reload();
  }

  onSearchChange(value: string): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value.trim());
      this.reload();
    }, SEARCH_DEBOUNCE_MS);
  }

  reload(): void {
    this.loadSub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(false);
    this.loadSub = this.fetchAll({
      isActive: true,
      sortBy: 'firstSurname',
      sortOrder: 'ASC',
      search: this.search() || undefined,
      tagRuleOk: this.mode() === 'pending' ? false : undefined,
      limit: PAGE_SIZE,
    }).subscribe({
      next: (people) => {
        this.people.set(people);
        this.index.set(0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  next(): void {
    this.move(1);
  }

  previous(): void {
    this.move(-1);
  }

  hasTag(person: Person, tagId: string): boolean {
    return person.positions.some((p) => p.id === tagId);
  }

  isBusy(person: Person, tagId: string): boolean {
    return this.inFlight().has(`${person.id}:${tagId}`);
  }

  toggleTag(tag: TagWithCount): void {
    const person = this.current();
    if (!person) return;
    const key = `${person.id}:${tag.id}`;
    if (this.inFlight().has(key)) return;

    const had = this.hasTag(person, tag.id);
    const add = (positions: Position[]) => [...positions, toPosition(tag)];
    const remove = (positions: Position[]) => positions.filter((p) => p.id !== tag.id);

    this.patchPositions(person.id, had ? remove : add);
    this.setInFlight(key, true);

    const request = had
      ? this.tagService.unassignPerson(tag.id, person.id)
      : this.tagService.assignPersons(tag.id, [person.id]);

    request.subscribe({
      next: () => this.setInFlight(key, false),
      error: () => {
        this.setInFlight(key, false);
        this.patchPositions(person.id, had ? add : remove);
        this.toast.error("No s'ha pogut alçar l'etiqueta.");
      },
    });
  }

  openDetail(person: Person): void {
    const url = this.router.serializeUrl(this.router.createUrlTree(['/persons', person.id]));
    window.open(url, '_blank', 'noopener');
  }

  private move(delta: 1 | -1): void {
    const result = advance(this.people(), this.index(), delta, this.mode());
    this.people.set(result.people);
    this.index.set(result.index);
  }

  private patchPositions(personId: string, fn: (positions: Position[]) => Position[]): void {
    this.people.update((list) => list.map((p) => (p.id === personId ? { ...p, positions: fn(p.positions) } : p)));
  }

  private setInFlight(key: string, busy: boolean): void {
    this.inFlight.update((set) => {
      const next = new Set(set);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  /** `GET /persons` limita a 100 per pàgina: carrega-les totes. */
  private fetchAll(filters: PersonFilterParams): Observable<Person[]> {
    return this.personService.getAll({ ...filters, page: 1 }).pipe(
      switchMap((first) => {
        const pages = Math.ceil(first.meta.total / PAGE_SIZE);
        if (pages <= 1) return of(first.data);
        const rest = Array.from({ length: pages - 1 }, (_, i) =>
          this.personService.getAll({ ...filters, page: i + 2 }),
        );
        return forkJoin(rest).pipe(map((responses) => [first.data, ...responses.map((r) => r.data)].flat()));
      }),
    );
  }
}
