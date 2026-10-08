# Assistent d'etiquetatge de persones — Pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modal a `/config/tags` que recorre persones (pendents o totes) i en desa les etiquetes a un clic, més una banda amb el recompte de pendents.

**Architecture:** Només frontend (dashboard). Una util pura (`tagging-queue.util.ts`) decideix com avança la cua; un component standalone (`app-tagging-wizard-modal`) carrega persones amb `PersonService.getAll`, desa amb `TagService.assignPersons/unassignPerson` (optimista, es reverteix si falla); `tags-list` mostra la banda i obri el modal.

**Tech Stack:** Angular 21 (standalone, OnPush, Signals), `@muixer/ui` (`lib-modal`, `lib-tabs`, `lib-badge clickable`, `lib-input`, `lib-button`, `lib-alert`, `lib-empty-state`), Vitest, `@muixer/shared` (`evaluateTagCompliance`).

**Spec:** `docs/superpowers/specs/2026-10-05-person-tagging-wizard-design.md`

## Global Constraints

- Textos de UI en valencià, imperatiu 2a singular per a ordres a l'app, «vós» per a missatges a l'usuari (`.agents/skills/language-rules/SKILL.md`). Codi, noms i commits en anglés.
- Components `standalone` + `ChangeDetectionStrategy.OnPush` + Signals; `input()`/`output()`, mai `@Input`/`@Output`.
- Només components de `@muixer/ui` i tokens del sistema de disseny; cap color hex ni valor arbitrari de Tailwind. Els xips d'etiqueta són `<lib-badge clickable readableOutlineText [selected] [color]>` (mateix patró que `person-detail.component.html`).
- Sense canvis de backend. `GET /persons` màxim `limit=100`.
- No afegir `Co-Authored-By` als commits (preferència de l'usuari).
- No mostrar gènere, edat, data d'ingrés ni telèfon al modal.
- Tests co-localitzats `*.spec.ts` (Vitest); icones als tests amb `allLucideIconsProvider` de `apps/dashboard/src/testing/lucide-test-provider`.

## Review Focus

- Etiquetar l'última persona de la cua de pendents fins que compleix la regla i prémer «Següent»: no ha de trencar l'índex (el botó queda desactivat, la persona continua visible).
- Cua de pendents buida en obrir (o després de cercar sense resultats): estat buit, sense persona actual ni xips.
- Desfer una etiqueta mentre una altra petició és en vol: la reversió només toca l'etiqueta fallida, no la resta.
- Doble clic ràpid al mateix xip: només una petició en vol per parella persona-etiqueta.
- Canviar de mode o cercar mentre una càrrega anterior encara és en vol: la resposta antiga no pot sobreescriure la nova.
- Persones amb `notes`/`shoulderHeight` nuls: la fitxa mostra «Sense alçada d'espatlles» i omet les notes.

---

### Task 0: Commitejar el filtre per categoria que ja hi ha

**Files:**
- Modify (ja modificats, sense commitejar): `apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.html`, `apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.ts`

- [ ] **Step 1: Verifica que els tests existents passen**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.spec.ts`
Expected: PASS

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.html apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.ts
git commit -m "feat(dashboard): add category filter to tags list"
```

---

### Task 1: Util pura de la cua

**Files:**
- Create: `apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-queue.util.ts`
- Test: `apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-queue.util.spec.ts`

**Interfaces:**
- Produces:
  - `type TaggingMode = 'pending' | 'all'`
  - `isTagCompliant(person: Pick<Person, 'positions'>): boolean`
  - `advance(people: Person[], index: number, delta: 1 | -1, mode: TaggingMode): { people: Person[]; index: number }`

- [ ] **Step 1: Escriu el test que falla**

```ts
import { TagCategory } from '@muixer/shared';
import { Person, Position } from '../../../persons/models/person.model';
import { advance, isTagCompliant } from './tagging-queue.util';

const pos = (category: TagCategory, id = category): Position => ({
  id,
  name: id,
  slug: id,
  zone: null,
  color: '#000000',
  category,
});

const person = (id: string, positions: Position[] = []): Person => ({ id, positions }) as Person;

describe('tagging-queue.util', () => {
  describe('isTagCompliant', () => {
    it('is false with no tags', () => {
      expect(isTagCompliant(person('a'))).toBe(false);
    });
    it('is false with only PINYA', () => {
      expect(isTagCompliant(person('a', [pos(TagCategory.PINYA)]))).toBe(false);
    });
    it('is true with PINYA and TRONC', () => {
      expect(isTagCompliant(person('a', [pos(TagCategory.PINYA), pos(TagCategory.TRONC)]))).toBe(true);
    });
    it('is true with XICALLA alone', () => {
      expect(isTagCompliant(person('a', [pos(TagCategory.XICALLA)]))).toBe(true);
    });
  });

  describe('advance', () => {
    const ok = [pos(TagCategory.XICALLA)];

    it('moves forward and keeps everyone in all mode', () => {
      const list = [person('a', ok), person('b')];
      expect(advance(list, 0, 1, 'all')).toEqual({ people: list, index: 1 });
    });

    it('drops the person left behind when now compliant in pending mode', () => {
      const list = [person('a', ok), person('b'), person('c')];
      const r = advance(list, 0, 1, 'pending');
      expect(r.people.map((p) => p.id)).toEqual(['b', 'c']);
      expect(r.index).toBe(0);
    });

    it('keeps the person left behind when still pending', () => {
      const list = [person('a'), person('b')];
      expect(advance(list, 0, 1, 'pending')).toEqual({ people: list, index: 1 });
    });

    it('drops the compliant person when going back', () => {
      const list = [person('a'), person('b', ok)];
      const r = advance(list, 1, -1, 'pending');
      expect(r.people.map((p) => p.id)).toEqual(['a']);
      expect(r.index).toBe(0);
    });

    it('does not move past the end, even if the last person is compliant', () => {
      const list = [person('a'), person('b', ok)];
      expect(advance(list, 1, 1, 'pending')).toEqual({ people: list, index: 1 });
    });

    it('does not move before the start', () => {
      const list = [person('a')];
      expect(advance(list, 0, -1, 'pending')).toEqual({ people: list, index: 0 });
    });
  });
});
```

- [ ] **Step 2: Executa el test i comprova que falla**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-queue.util.spec.ts`
Expected: FAIL (`Cannot find module './tagging-queue.util'`)

- [ ] **Step 3: Implementació mínima**

```ts
import { evaluateTagCompliance } from '@muixer/shared';
import { Person } from '../../../persons/models/person.model';

export type TaggingMode = 'pending' | 'all';

/** Mateixa regla mínima que el servidor (`tagRuleOk`), calculada al client. */
export function isTagCompliant(person: Pick<Person, 'positions'>): boolean {
  return evaluateTagCompliance(person.positions.map((tag) => tag.category)).ok;
}

/**
 * Mou el cursor `delta` posicions. Al mode `pending`, la persona que es deixa enrere s'elimina
 * de la cua si ja compleix la regla; la persona actual no es retira mai mentre es veu.
 */
export function advance(
  people: Person[],
  index: number,
  delta: 1 | -1,
  mode: TaggingMode,
): { people: Person[]; index: number } {
  const target = index + delta;
  if (target < 0 || target >= people.length) return { people, index };

  if (mode === 'pending' && isTagCompliant(people[index])) {
    return {
      people: people.filter((_, i) => i !== index),
      index: delta === 1 ? index : target,
    };
  }
  return { people, index: target };
}
```

- [ ] **Step 4: Executa el test i comprova que passa**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-queue.util.spec.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-queue.util.ts apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-queue.util.spec.ts
git commit -m "feat(dashboard): add tagging queue advance util"
```

---

### Task 2: Component `app-tagging-wizard-modal`

**Files:**
- Create: `apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-wizard-modal.component.ts`
- Create: `apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-wizard-modal.component.html`
- Test: `apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-wizard-modal.component.spec.ts`

**Interfaces:**
- Consumes: `advance`, `isTagCompliant`, `TaggingMode` (Task 1); `PersonService.getAll(filters): Observable<PaginatedResponse<Person>>`; `TagService.getAll()`, `assignPersons(tagId, [personId])`, `unassignPerson(tagId, personId)`; `ToastService.error(msg)`.
- Produces: selector `app-tagging-wizard-modal`, output `closed: OutputEmitterRef<void>`. Mètodes públics usats pels tests: `toggleTag(tag: TagWithCount)`, `next()`, `previous()`, `setMode(mode: TaggingMode)`, `onSearchChange(value: string)`, `reload()`, `openDetail(person: Person)`; signals `people`, `index`, `current`, `mode`, `loading`, `loadError`.

- [ ] **Step 1: Escriu els tests que fallen**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError, Subject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { TagCategory } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { TaggingWizardModalComponent } from './tagging-wizard-modal.component';
import { PersonService } from '../../../persons/services/person.service';
import { TagService } from '../../services/tag.service';
import { TagWithCount } from '../../models/tag.model';
import { Person, Position } from '../../../persons/models/person.model';

const tag = (id: string, category: TagCategory): TagWithCount => ({
  id,
  name: id,
  slug: id,
  shortDescription: null,
  longDescription: null,
  color: '#6366f1',
  category,
  positionTypes: [],
  personCount: 0,
});
const position = (t: TagWithCount): Position => ({
  id: t.id,
  name: t.name,
  slug: t.slug,
  zone: null,
  color: t.color ?? '',
  category: t.category,
});
const person = (id: string, positions: Position[] = []): Person =>
  ({ id, name: id, firstSurname: 'X', secondSurname: null, alias: id, isXicalla: false, shoulderHeight: null, notes: null, notesEmoji: null, positions }) as Person;
const page = (data: Person[], total = data.length) => ({ data, meta: { total, page: 1, limit: 100 } });

const PINYA = tag('pinya', TagCategory.PINYA);
const TRONC = tag('tronc', TagCategory.TRONC);

describe('TaggingWizardModalComponent', () => {
  let fixture: ComponentFixture<TaggingWizardModalComponent>;
  let component: TaggingWizardModalComponent;
  let personService: { getAll: ReturnType<typeof vi.fn> };
  let tagService: { getAll: ReturnType<typeof vi.fn>; assignPersons: ReturnType<typeof vi.fn>; unassignPerson: ReturnType<typeof vi.fn> };
  let toast: { error: ReturnType<typeof vi.fn> };

  async function setup(people: Person[] = [person('a'), person('b')]) {
    personService = { getAll: vi.fn().mockReturnValue(of(page(people))) };
    tagService = {
      getAll: vi.fn().mockReturnValue(of([PINYA, TRONC])),
      assignPersons: vi.fn().mockReturnValue(of(undefined)),
      unassignPerson: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TaggingWizardModalComponent],
      providers: [
        { provide: PersonService, useValue: personService },
        { provide: TagService, useValue: tagService },
        { provide: ToastService, useValue: toast },
        allLucideIconsProvider,
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TaggingWizardModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads active non-compliant people in pending mode', async () => {
    await setup();
    expect(personService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true, tagRuleOk: false, page: 1, limit: 100 }),
    );
    expect(component.people().map((p) => p.id)).toEqual(['a', 'b']);
    expect(component.current()?.id).toBe('a');
  });

  it('loads everyone in all mode (no tagRuleOk filter)', async () => {
    await setup();
    component.setMode('all');
    const last = personService.getAll.mock.calls.at(-1)![0];
    expect(last.tagRuleOk).toBeUndefined();
    expect(last.isActive).toBe(true);
  });

  it('fetches the remaining pages when total exceeds one page', async () => {
    personService = { getAll: vi.fn() };
    personService.getAll
      .mockReturnValueOnce(of(page([person('a')], 150)))
      .mockReturnValueOnce(of(page([person('b')], 150)));
    tagService = { getAll: vi.fn().mockReturnValue(of([])), assignPersons: vi.fn(), unassignPerson: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TaggingWizardModalComponent],
      providers: [
        { provide: PersonService, useValue: personService },
        { provide: TagService, useValue: tagService },
        { provide: ToastService, useValue: { error: vi.fn() } },
        allLucideIconsProvider,
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TaggingWizardModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(personService.getAll).toHaveBeenCalledTimes(2);
    expect(component.people().map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('assigns a tag immediately and updates the current person', async () => {
    await setup();
    component.toggleTag(PINYA);
    expect(tagService.assignPersons).toHaveBeenCalledWith('pinya', ['a']);
    expect(component.current()?.positions.map((p) => p.id)).toEqual(['pinya']);
  });

  it('removes a tag that is already assigned', async () => {
    await setup([person('a', [position(PINYA)])]);
    component.toggleTag(PINYA);
    expect(tagService.unassignPerson).toHaveBeenCalledWith('pinya', 'a');
    expect(component.current()?.positions).toEqual([]);
  });

  it('reverts only the failed tag and shows a toast', async () => {
    await setup([person('a', [position(PINYA)])]);
    tagService.assignPersons.mockReturnValue(throwError(() => new Error('boom')));
    component.toggleTag(TRONC);
    expect(component.current()?.positions.map((p) => p.id)).toEqual(['pinya']);
    expect(toast.error).toHaveBeenCalledWith("No s'ha pogut desar l'etiqueta.");
  });

  it('ignores a second click on the same tag while its request is in flight', async () => {
    await setup();
    const pending = new Subject<void>();
    tagService.assignPersons.mockReturnValue(pending);
    component.toggleTag(PINYA);
    component.toggleTag(PINYA);
    expect(tagService.assignPersons).toHaveBeenCalledTimes(1);
  });

  it('drops a now-compliant person on next in pending mode but keeps them until then', async () => {
    await setup([person('a'), person('b')]);
    component.toggleTag(PINYA);
    component.toggleTag(TRONC);
    expect(component.people().map((p) => p.id)).toEqual(['a', 'b']);
    component.next();
    expect(component.people().map((p) => p.id)).toEqual(['b']);
    expect(component.current()?.id).toBe('b');
  });

  it('keeps the last person visible after becoming compliant', async () => {
    await setup([person('a')]);
    component.toggleTag(PINYA);
    component.toggleTag(TRONC);
    component.next();
    expect(component.current()?.id).toBe('a');
  });

  it('shows an empty state when there is nobody to tag', async () => {
    await setup([]);
    expect(component.current()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No hi ha persones pendents');
  });

  it('shows a retry state when loading fails', async () => {
    await setup();
    personService.getAll.mockReturnValue(throwError(() => new Error('boom')));
    component.reload();
    expect(component.loadError()).toBe(true);
  });

  it('ignores a stale response when mode changes mid-load', async () => {
    await setup();
    const slow = new Subject<ReturnType<typeof page>>();
    personService.getAll.mockReturnValueOnce(slow).mockReturnValueOnce(of(page([person('z')])));
    component.setMode('all');
    component.setMode('pending');
    slow.next(page([person('stale')]));
    slow.complete();
    expect(component.people().map((p) => p.id)).toEqual(['z']);
  });

  it('opens the person detail in a new tab', async () => {
    await setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    component.openDetail(person('a'));
    expect(open).toHaveBeenCalledWith('/persons/a', '_blank', 'noopener');
  });

  it('emits closed when the modal closes', async () => {
    await setup();
    const spy = vi.fn();
    component.closed.subscribe(spy);
    component.closed.emit();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Executa els tests i comprova que fallen**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-wizard-modal.component.spec.ts`
Expected: FAIL (`Cannot find module './tagging-wizard-modal.component'`)

- [ ] **Step 3: Implementa el component (TS)**

```ts
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
import { TaggingMode, advance } from './tagging-queue.util';

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
  readonly isLast = computed(() => this.index() >= this.people().length - 1);
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
        this.toast.error("No s'ha pogut desar l'etiqueta.");
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
```

- [ ] **Step 4: Implementa la plantilla**

```html
<lib-modal [open]="true" title="Etiqueta persones" size="2xl" (closed)="closed.emit()">
  <div class="flex flex-col gap-4">

    <!-- Mode + cerca -->
    <div class="flex flex-col sm:flex-row sm:items-end gap-3">
      <lib-tabs
        class="shrink-0"
        ariaLabel="Mode de l'assistent"
        [tabs]="modeTabs"
        [activeId]="mode()"
        (activeIdChange)="setMode($any($event))"
      />
      <div class="w-full sm:flex-1">
        <lib-input
          ariaLabel="Cerca persona"
          placeholder="Nom, àlies o cognoms..."
          [icon]="SearchIcon"
          [(ngModel)]="searchInput"
          (ngModelChange)="onSearchChange($event)"
        />
      </div>
    </div>

    @if (loading()) {
      <div class="space-y-3" aria-busy="true">
        <div class="skeleton h-6 w-48"></div>
        <div class="skeleton h-4 w-64"></div>
        <div class="skeleton h-24 w-full"></div>
      </div>
    } @else if (loadError()) {
      <lib-empty-state
        message="No s'han pogut carregar les persones."
        actionLabel="Reintenta"
        (clicked)="reload()"
      />
    } @else if (current(); as person) {

      <!-- Fitxa -->
      <section class="flex flex-col gap-2" aria-live="polite">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-lg font-semibold truncate">
              {{ person.name }} {{ person.firstSurname }} {{ person.secondSurname }}
            </h3>
            <div class="flex flex-wrap items-center gap-2 mt-1">
              <lib-badge size="sm">{{ person.alias }}</lib-badge>
              @if (person.isXicalla) {
                <lib-badge size="sm" variant="info">Menor de 16</lib-badge>
              }
              <span class="text-sm text-base-content/70 tabular-nums">
                @if (person.shoulderHeight) {
                  Alçada d'espatlles: {{ person.shoulderHeight }} cm
                } @else {
                  Sense alçada d'espatlles
                }
              </span>
            </div>
          </div>
          <lib-button variant="ghost" size="xs" (clicked)="openDetail(person)">
            Veu el detall
            <lucide-icon [img]="ExternalLinkIcon" [size]="14" aria-hidden="true" />
          </lib-button>
        </div>
        @if (person.notes) {
          <p class="text-sm bg-base-200 rounded-box p-3">
            @if (person.notesEmoji) {
              <span aria-hidden="true">{{ person.notesEmoji }}</span>
            }
            {{ person.notes }}
          </p>
        }
      </section>

      <!-- Etiquetes per categoria -->
      <section class="flex flex-col gap-3">
        @for (group of groups(); track group.category) {
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-base-content/60 mb-1.5">{{ group.label }}</p>
            <div class="flex flex-wrap gap-1.5" role="group" [attr.aria-label]="'Etiquetes de ' + group.label">
              @for (tag of group.tags; track tag.id) {
                <lib-badge
                  size="md"
                  clickable
                  readableOutlineText
                  [selected]="hasTag(person, tag.id)"
                  [color]="tag.color ?? undefined"
                  (clicked)="toggleTag(tag)"
                >
                  {{ tag.name }}
                </lib-badge>
              }
            </div>
          </div>
        }
      </section>

    } @else {
      <lib-empty-state
        [message]="mode() === 'pending'
          ? 'No hi ha persones pendents d\'etiquetar.'
          : 'No s\'ha trobat cap persona.'"
        [actionLabel]="mode() === 'pending' ? 'Revisa tothom' : undefined"
        (clicked)="setMode('all')"
      />
    }
  </div>

  <div modalFooter class="w-full flex items-center justify-between gap-2">
    <span class="text-sm text-base-content/60 tabular-nums">
      @if (current()) {
        {{ index() + 1 }} de {{ people().length }}
      }
    </span>
    <div class="flex gap-2">
      <lib-button variant="ghost" size="sm" [disabled]="index() === 0 || !current()" (clicked)="previous()">
        Anterior
      </lib-button>
      <lib-button variant="primary" size="sm" [disabled]="isLast() || !current()" (clicked)="next()">
        Següent
      </lib-button>
    </div>
  </div>
</lib-modal>
```

- [ ] **Step 5: Executa els tests i comprova que passen**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-wizard-modal.component.spec.ts`
Expected: PASS (14 tests). Si algun test de `lib-modal` falla perquè jsdom no té `HTMLDialogElement.showModal`, mira com ho resolen els specs de `tag-form-modal` (`tag-form-modal.component.spec.ts`) i replica el mateix stub al `beforeEach`.

- [ ] **Step 6: Lint**

Run: `nx lint dashboard`
Expected: sense errors nous.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/app/features/config/components/tagging-wizard-modal
git commit -m "feat(dashboard): add person tagging wizard modal"
```

---

### Task 3: Banda de pendents a `tags-list`

**Files:**
- Modify: `apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.ts`
- Modify: `apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.html`
- Modify: `apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.spec.ts`

**Interfaces:**
- Consumes: `app-tagging-wizard-modal` i el seu output `closed` (Task 2); `PersonService.getAll({ isActive: true, tagRuleOk: false, limit: 1 })` → `meta.total`.
- Produces: signals `pendingCount: number | null`, `wizardOpen: boolean`; mètodes `openWizard()`, `onWizardClosed()`.

- [ ] **Step 1: Afegeix els tests que fallen** al final del `describe` de `tags-list.component.spec.ts`

Primer, al `beforeEach` afegeix el mock de `PersonService` i registra'l als `providers`:

```ts
import { PersonService } from '../../../persons/services/person.service';
// ...
let personService: { getAll: ReturnType<typeof vi.fn> };
// dins beforeEach, abans de configureTestingModule:
personService = { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 4, page: 1, limit: 1 } })) };
// dins providers:
{ provide: PersonService, useValue: personService },
```

Tests nous:

```ts
it('loads the pending count on init', () => {
  expect(personService.getAll).toHaveBeenCalledWith({ isActive: true, tagRuleOk: false, limit: 1 });
  expect(component.pendingCount()).toBe(4);
});

it('shows the pending banner with the count', () => {
  expect(fixture.nativeElement.textContent).toContain('4 persones pendents d\'etiquetar');
});

it('hides the banner when nobody is pending', () => {
  personService.getAll.mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 1 } }));
  component.onWizardClosed();
  fixture.detectChanges();
  expect(component.pendingCount()).toBe(0);
  expect(fixture.nativeElement.textContent).not.toContain('pendents d\'etiquetar');
});

it('opens the wizard and refreshes the count when it closes', () => {
  component.openWizard();
  expect(component.wizardOpen()).toBe(true);
  personService.getAll.mockClear();
  component.onWizardClosed();
  expect(component.wizardOpen()).toBe(false);
  expect(personService.getAll).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Executa i comprova que falla**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.spec.ts`
Expected: FAIL (`pendingCount is not a function`)

- [ ] **Step 3: Implementa** (`tags-list.component.ts`)

Imports: afegeix `AlertComponent` a l'import de `@muixer/ui`, `PersonService` i `TaggingWizardModalComponent`, i registra'ls a `imports: [...]`.

```ts
import { PersonService } from '../../../persons/services/person.service';
import { TaggingWizardModalComponent } from '../tagging-wizard-modal/tagging-wizard-modal.component';
```

Dins la classe:

```ts
private readonly personService = inject(PersonService);

readonly pendingCount = signal<number | null>(null);
readonly wizardOpen = signal(false);

openWizard(): void {
  this.wizardOpen.set(true);
}

onWizardClosed(): void {
  this.wizardOpen.set(false);
  this.loadPendingCount();
}

private loadPendingCount(): void {
  this.personService.getAll({ isActive: true, tagRuleOk: false, limit: 1 }).subscribe({
    next: (res) => this.pendingCount.set(res.meta.total),
    error: () => this.pendingCount.set(null),
  });
}
```

Al `constructor()`, després de `this.loadTags();`: `this.loadPendingCount();`

- [ ] **Step 4: Implementa la plantilla** (`tags-list.component.html`)

Entre `</app-page-header>` i el comentari `<!-- Filtre per categoria -->`:

```html
  <!-- Pendents d'etiquetar -->
  @if (pendingCount(); as pending) {
    <lib-alert variant="warning" dense>
      {{ pending }} {{ pending === 1 ? 'persona pendent' : 'persones pendents' }} d'etiquetar
      <lib-button actions variant="warning" size="xs" (clicked)="openWizard()">Etiqueta-les</lib-button>
    </lib-alert>
  }
```

Al final del fitxer, després del `<lib-modal>` de confirmació:

```html
<!-- Modal: Assistent d'etiquetatge -->
@if (wizardOpen()) {
  <app-tagging-wizard-modal (closed)="onWizardClosed()" />
}
```

Afegeix també un botó d'accés per a la revisió completa a la capçalera, abans de «Etiqueta nova»:

```html
    <lib-button variant="ghost" size="sm" (clicked)="openWizard()">Etiqueta persones</lib-button>
```

- [ ] **Step 5: Executa els tests i comprova que passen**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/config/components/tags-list/tags-list.component.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/features/config/components/tags-list
git commit -m "feat(dashboard): show pending-to-tag banner and open tagging wizard"
```

---

### Task 4: Documentació i verificació final

**Files:**
- Modify: `docs/TAGS.md` (§4, secció «Només es veu en tres llocs»)
- Modify: `CLAUDE.md` (fila de `/config/tags` a Frontend dashboard)

- [ ] **Step 1: Documenta**

A `docs/TAGS.md` §4 afegeix, després de la llista dels tres llocs, un paràgraf:

```
A `/config/tags` hi ha, a més, una banda «N persones pendents d'etiquetar» (el mateix filtre
`tagRuleOk=false` sobre persones actives) que obri l'**assistent d'etiquetatge**
(`tagging-wizard-modal`): un modal que recorre persones i desa cada etiqueta al moment. Té el
mode «Pendents» (la cua es va buidant en avançar) i el mode «Tothom» (repàs complet per cognom).
```

A `CLAUDE.md`, a la línia de rutes: `/config/tags` → afegeix «(inclou l'assistent d'etiquetatge)».

- [ ] **Step 2: Verificació completa**

Run: `nx test dashboard && nx lint dashboard && nx build dashboard`
Expected: tots passen.

- [ ] **Step 3: Verificació visual**

Run: `nx serve api` i `nx serve dashboard`; entra a `http://localhost:4200/config/tags` com a TECHNICAL/ADMIN. Comprova: banda amb recompte; el modal obri en «Pendents»; clic en xip desa (Network: `POST /api/tags/:id/persons`); «Següent» retira la persona que ja compleix; «Tothom» manté la llista; «Veu el detall» obri `/persons/:id` en pestanya nova; cerca; mode fosc i amplada de mòbil (<640px) sense desbordament horitzontal.

- [ ] **Step 4: Commit**

```bash
git add docs/TAGS.md CLAUDE.md
git commit -m "docs: document tagging wizard"
```
