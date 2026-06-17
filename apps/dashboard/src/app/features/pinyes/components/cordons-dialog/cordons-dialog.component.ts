import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { ChevronDown, ChevronRight, LucideAngularModule, Minus, Plus } from 'lucide-angular';
import { RenglaModel } from '../../models/figure-template.model';

export interface CordonsDialogSaveEvent {
  numberOfCordons: number | null;
  openCordons: string[];
}

interface NodeForGrouping {
  renglaId: string | null;
  positionType: string | null;
  renglaPosition: number | null;
}

interface RenglaGroup {
  key: string;
  label: string;
  rengles: RenglaModel[];
}

const POSITION_TYPE_LABELS: Record<string, string> = {
  agulla: 'Agulla',
  mans: 'Mans',
  laterals: 'Laterals',
  vents: 'Vents',
  'cordo-obert': 'Cordó obert',
  tap: 'Tap',
  crossa: 'Crossa',
  contrafort: 'Contrafort',
  comodin: 'Comodí',
};

@Component({
  selector: 'app-cordons-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    @if (open()) {
      <dialog
        class="modal modal-open"
        role="dialog"
        aria-labelledby="cordons-dialog-title"
        aria-modal="true"
      >
        <div class="modal-box max-w-sm">
          <h3 id="cordons-dialog-title" class="text-lg font-bold mb-4">Configuració de cordons</h3>

          <div class="form-control mb-4">
            <label class="label" for="cordons-count">
              <span class="label-text font-medium">Cordons visibles</span>
            </label>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="btn btn-sm btn-outline btn-square"
                [disabled]="localCordons() !== null && localCordons()! <= 1"
                (click)="decrement()"
                aria-label="Reduir cordons"
              >
                <i-lucide [img]="Minus" class="size-4" />
              </button>
              <span class="text-lg font-semibold min-w-[3rem] text-center" aria-live="polite">
                {{ localCordons() === null ? 'Tots' : localCordons() }}
              </span>
              <button
                type="button"
                class="btn btn-sm btn-outline btn-square"
                [disabled]="localCordons() !== null && localCordons()! >= maxCordons()"
                (click)="increment()"
                aria-label="Augmentar cordons"
              >
                <i-lucide [img]="Plus" class="size-4" />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                [class.btn-active]="localCordons() === null"
                (click)="setAll()"
              >
                Tots
              </button>
            </div>
            <p class="text-xs text-base-content/50 mt-1">
              Mostra els nodes fins al cordó seleccionat.
            </p>
          </div>

          @if (rengles().length > 0) {
            <div class="divider my-2"></div>
            <div class="form-control">
              <div class="flex items-center justify-between mb-2">
                <span class="label-text font-medium">Cordó obert</span>
                <div class="flex gap-1">
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost"
                    [disabled]="allOpen()"
                    (click)="toggleAll(true)"
                  >
                    Activa totes
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost"
                    [disabled]="noneOpen()"
                    (click)="toggleAll(false)"
                  >
                    Desactiva totes
                  </button>
                </div>
              </div>

              @if (!isGrouped()) {
                <!-- Flat list with single expand toggle -->
                <button
                  type="button"
                  class="btn btn-xs btn-ghost self-start gap-1 mb-1"
                  (click)="toggleGroupExpand('all')"
                >
                  <i-lucide
                    [img]="isGroupExpanded('all') ? ChevronDown : ChevronRight"
                    class="size-3"
                  />
                  {{ isGroupExpanded('all') ? 'Amaga' : 'Mostra' }} les rengles
                  <span class="text-base-content/50">({{ openCount() }}/{{ rengles().length }})</span>
                </button>
                @if (isGroupExpanded('all')) {
                  <div class="space-y-0.5 max-h-56 overflow-y-auto">
                    @for (rengla of rengles(); track rengla.id) {
                      <label class="flex items-center gap-3 cursor-pointer px-2 py-1.5 rounded hover:bg-base-200 transition-colors">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-primary"
                          [checked]="isRenglaOpen(rengla.id)"
                          (change)="toggleRengla(rengla.id)"
                          [attr.aria-label]="'Cordó obert per ' + rengla.name"
                        />
                        <span class="text-sm">{{ rengla.name }}</span>
                      </label>
                    }
                  </div>
                }
              } @else {
                <!-- Grouped view with per-group expand toggles -->
                <div class="space-y-0.5 max-h-64 overflow-y-auto">
                  @for (group of groupedRengles(); track group.key) {
                    <div class="sticky top-0 bg-base-100 z-10 flex items-center justify-between px-1 py-1">
                      <button
                        type="button"
                        class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-base-content/50 hover:text-base-content transition-colors"
                        (click)="toggleGroupExpand(group.key)"
                        [attr.aria-expanded]="isGroupExpanded(group.key)"
                      >
                        <i-lucide
                          [img]="isGroupExpanded(group.key) ? ChevronDown : ChevronRight"
                          class="size-3 shrink-0"
                        />
                        {{ group.label }}
                        <span class="font-normal text-base-content/40 normal-case tracking-normal">
                          ({{ groupOpenCount(group.rengles) }}/{{ group.rengles.length }})
                        </span>
                      </button>
                      <div class="flex gap-1 shrink-0">
                        <button
                          type="button"
                          class="btn btn-xs btn-ghost"
                          [disabled]="isGroupAllOpen(group.rengles)"
                          (click)="toggleGroup(group.rengles, true)"
                        >
                          Activa
                        </button>
                        <button
                          type="button"
                          class="btn btn-xs btn-ghost"
                          [disabled]="isGroupNoneOpen(group.rengles)"
                          (click)="toggleGroup(group.rengles, false)"
                        >
                          Desactiva
                        </button>
                      </div>
                    </div>
                    @if (isGroupExpanded(group.key)) {
                      @for (rengla of group.rengles; track rengla.id) {
                        <label class="flex items-center gap-3 cursor-pointer pl-6 pr-2 py-1.5 rounded hover:bg-base-200 transition-colors">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-sm checkbox-primary"
                            [checked]="isRenglaOpen(rengla.id)"
                            (change)="toggleRengla(rengla.id)"
                            [attr.aria-label]="'Cordó obert per ' + rengla.name"
                          />
                          <span class="text-sm">{{ rengla.name }}</span>
                        </label>
                      }
                    }
                  }
                </div>
              }
            </div>
          }

          <div class="modal-action mt-6">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="onCancel()"
            >
              Cancel·lar
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              (click)="onSave()"
            >
              Desar
            </button>
          </div>
        </div>
        <button type="button" class="modal-backdrop" (click)="onCancel()" aria-label="Tancar"></button>
      </dialog>
    }
  `,
})
export class CordonsDialogComponent {
  readonly open = input.required<boolean>();
  readonly numberOfCordons = input.required<number | null>();
  readonly openCordons = input.required<string[]>();
  readonly rengles = input.required<RenglaModel[]>();
  readonly maxCordons = input.required<number>();
  readonly nodes = input<NodeForGrouping[]>([]);

  readonly saved = output<CordonsDialogSaveEvent>();
  readonly closed = output<void>();

  readonly Minus = Minus;
  readonly Plus = Plus;
  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;

  readonly localCordons = signal<number | null>(null);
  readonly localOpenCordons = signal<string[]>([]);
  readonly expandedGroups = signal<Set<string>>(new Set());

  readonly hasChanges = computed(() => {
    return (
      this.localCordons() !== this.numberOfCordons() ||
      JSON.stringify(this.localOpenCordons().sort()) !== JSON.stringify([...(this.openCordons() ?? [])].sort())
    );
  });

  readonly groupedRengles = computed((): RenglaGroup[] => {
    const rengles = this.rengles();
    const nodes = this.nodes();

    if (nodes.length === 0) {
      return [{ key: 'all', label: '', rengles }];
    }

    const renglaToType = new Map<string, string>();
    for (const rengla of rengles) {
      const firstNode = nodes
        .filter((n) => n.renglaId === rengla.id && n.renglaPosition !== null)
        .sort((a, b) => (a.renglaPosition ?? 0) - (b.renglaPosition ?? 0))[0];
      renglaToType.set(rengla.id, firstNode?.positionType ?? 'other');
    }

    const groupOrder: string[] = [];
    const groupMap = new Map<string, RenglaModel[]>();
    for (const rengla of rengles) {
      const key = renglaToType.get(rengla.id) ?? 'other';
      if (!groupMap.has(key)) {
        groupOrder.push(key);
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(rengla);
    }

    return groupOrder.map((key) => ({
      key,
      label: POSITION_TYPE_LABELS[key] ?? key,
      rengles: groupMap.get(key)!,
    }));
  });

  readonly isGrouped = computed(() => this.groupedRengles().length > 1);

  readonly allOpen = computed(() =>
    this.rengles().length > 0 && this.rengles().every((r) => this.isRenglaOpen(r.id)),
  );

  readonly noneOpen = computed(() =>
    this.rengles().every((r) => !this.isRenglaOpen(r.id)),
  );

  readonly openCount = computed(() =>
    this.rengles().filter((r) => this.isRenglaOpen(r.id)).length,
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        this.localCordons.set(this.numberOfCordons());
        this.localOpenCordons.set([...(this.openCordons() ?? [])]);
        this.expandedGroups.set(new Set());
      }
    });
  }

  isGroupExpanded(key: string): boolean {
    return this.expandedGroups().has(key);
  }

  toggleGroupExpand(key: string): void {
    this.expandedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  decrement(): void {
    const current = this.localCordons();
    if (current === null) {
      this.localCordons.set(this.maxCordons() - 1 || 1);
    } else if (current > 1) {
      this.localCordons.set(current - 1);
    }
  }

  increment(): void {
    const current = this.localCordons();
    if (current === null) return;
    if (current < this.maxCordons()) {
      this.localCordons.set(current + 1);
    }
  }

  setAll(): void {
    this.localCordons.set(null);
  }

  isRenglaOpen(renglaId: string): boolean {
    return this.localOpenCordons().includes(renglaId);
  }

  isGroupAllOpen(rengles: RenglaModel[]): boolean {
    return rengles.every((r) => this.isRenglaOpen(r.id));
  }

  isGroupNoneOpen(rengles: RenglaModel[]): boolean {
    return rengles.every((r) => !this.isRenglaOpen(r.id));
  }

  groupOpenCount(rengles: RenglaModel[]): number {
    return rengles.filter((r) => this.isRenglaOpen(r.id)).length;
  }

  toggleRengla(renglaId: string): void {
    this.localOpenCordons.update((list) =>
      list.includes(renglaId) ? list.filter((id) => id !== renglaId) : [...list, renglaId],
    );
  }

  toggleGroup(rengles: RenglaModel[], open: boolean): void {
    const ids = rengles.map((r) => r.id);
    if (open) {
      this.localOpenCordons.update((list) => [...new Set([...list, ...ids])]);
    } else {
      this.localOpenCordons.update((list) => list.filter((id) => !ids.includes(id)));
    }
  }

  toggleAll(open: boolean): void {
    if (open) {
      this.localOpenCordons.set(this.rengles().map((r) => r.id));
    } else {
      this.localOpenCordons.set([]);
    }
  }

  onSave(): void {
    this.saved.emit({
      numberOfCordons: this.localCordons(),
      openCordons: this.localOpenCordons(),
    });
  }

  onCancel(): void {
    this.closed.emit();
  }
}
