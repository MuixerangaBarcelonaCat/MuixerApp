import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, input, signal, viewChild } from '@angular/core';
import { Info, LucideAngularModule, TriangleAlert } from 'lucide-angular';
import { ButtonComponent, DOMAIN_ICONS } from '@muixer/ui';
import { QUADRE_HIGHLIGHT_CLASS, QUADRE_ROW_CLASSES, QuadreRowState } from '../../utils/quadre-troncs.util';

/** Width of the panel (w-80), to keep it inside the viewport. */
const PANEL_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

let nextId = 0;

type SampleMark = 'star' | 'warning' | 'dots' | 'height' | 'extra' | 'ring' | null;

interface LegendRow {
  /** Background of the sample, for the rows that explain a colour. */
  state: QuadreRowState | null;
  mark: SampleMark;
  label: string;
  /** Only meaningful when the event has a next performance. */
  needsNextPerformance: boolean;
}

const ROWS: LegendRow[] = [
  { state: 'both', mark: null, label: "Ve a l'assaig i a la propera actuació", needsNextPerformance: true },
  { state: 'notPerformance', mark: null, label: "Ve a l'assaig, però no a la propera actuació", needsNextPerformance: true },
  { state: 'unanswered', mark: null, label: "Ve a l'assaig i no ha contestat per a l'actuació", needsNextPerformance: true },
  { state: 'performanceOnly', mark: 'star', label: "No ve a l'assaig, però sí a la propera actuació", needsNextPerformance: true },
  { state: 'assignedAbsent', mark: 'warning', label: "Té un lloc assignat, però no ve a l'assaig", needsNextPerformance: true },
  { state: null, mark: 'star', label: 'Ve a la propera actuació', needsNextPerformance: true },
  { state: null, mark: 'extra', label: 'Al costat del nom de la columna: no vénen a l\'assaig, però sí a la propera actuació', needsNextPerformance: true },
  // Without a next performance (an actuació, or no actuació left in the season) only these apply.
  { state: 'neutral', mark: null, label: 'Ve', needsNextPerformance: false },
  { state: 'assignedAbsent', mark: 'warning', label: 'Té un lloc assignat, però no ve', needsNextPerformance: false },
];

const SHARED_ROWS: LegendRow[] = [
  { state: null, mark: 'dots', label: "Figures diferents de l'event en què fa tronc o base: ● una, ●● dues, ●●● tres, ●●●+ quatre o més. La pinya i les direccions no compten", needsNextPerformance: false },
  { state: null, mark: 'height', label: "Alçada d'espatles, relativa o en centímetres com a la resta de l'espai de treball", needsNextPerformance: false },
  { state: null, mark: 'ring', label: 'En passar el ratolí per damunt d\'una persona, es marquen totes les seues aparicions', needsNextPerformance: false },
];

/**
 * ⓘ legend of the quadre de persones: one row per colour and mark, each sample drawn with the same
 * classes as the real rows. Same popover pattern as the workspace's «Altres marques».
 */
@Component({
  selector: 'app-quadre-legend',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, LucideAngularModule],
  template: `
    <span #trigger class="inline-flex">
      <lib-button
        variant="ghost"
        size="sm"
        shape="square"
        ariaLabel="Llegenda del quadre"
        [ariaExpanded]="open()"
        [ariaControls]="panelId"
        (clicked)="toggle()"
      >
        <lucide-icon [img]="Info" [size]="16" aria-hidden="true" />
      </lib-button>
    </span>
    @if (open()) {
      <div
        #panel
        popover="auto"
        role="dialog"
        aria-label="Llegenda del quadre"
        [id]="panelId"
        class="fixed inset-auto m-0 z-dropdown w-80 max-h-96 overflow-y-auto bg-base-100 border border-base-300 rounded-box shadow-overlay p-3 text-sm text-base-content"
        [style.top.px]="position().top"
        [style.left.px]="position().left"
        (toggle)="onToggle($event)"
        (keydown.escape)="open.set(false)"
        data-testid="quadre-legend"
      >
        @if (!hasNextPerformance()) {
          <p class="mb-2 text-xs text-base-content/60" data-testid="quadre-legend-note">
            No hi ha cap actuació propera per a este event (és una actuació, o no en queda cap a la temporada): no es mostra qui ve a l'actuació.
          </p>
        }
        <ul class="flex flex-col gap-2">
          @for (row of rows(); track row.label) {
            <li class="flex items-center gap-3">
              <span
                class="flex h-6 w-16 shrink-0 items-center justify-center gap-1 rounded border border-base-300 text-xs"
                [class]="sampleClass(row)"
                [attr.data-state]="row.state"
                aria-hidden="true"
              >
                @switch (row.mark) {
                  @case ('star') { <lucide-icon [img]="ICON_ACTUACIO" class="size-2.5 fill-current text-base-content/80" /> }
                  @case ('warning') { <lucide-icon [img]="TriangleAlert" [size]="12" class="text-warning" /> }
                  @case ('dots') { <span class="tracking-tighter">●●</span> }
                  @case ('height') { <span class="text-base-content/50">+5</span> }
                  @case ('extra') { <span class="text-base-content/60">+2</span> }
                }
              </span>
              <span>{{ row.label }}</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class QuadreLegendComponent {
  readonly hasNextPerformance = input(true);

  protected readonly Info = Info;
  protected readonly TriangleAlert = TriangleAlert;
  protected readonly ICON_ACTUACIO = DOMAIN_ICONS.ACTUACIO;
  protected readonly panelId = `quadre-legend-${nextId++}`;

  protected readonly rows = computed(() => [
    ...ROWS.filter((r) => r.needsNextPerformance === this.hasNextPerformance()),
    ...SHARED_ROWS,
  ]);

  protected readonly open = signal(false);
  protected readonly position = signal({ top: 0, left: 0 });
  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement & { showPopover?: () => void }>>('panel');

  constructor() {
    // Native popover where the browser has it: top layer (above the modal), light dismiss and Escape.
    afterRenderEffect(() => {
      const el = this.panel()?.nativeElement;
      if (el && typeof el.showPopover === 'function' && !el.matches(':popover-open')) el.showPopover();
    });
  }

  protected sampleClass(row: LegendRow): string {
    if (row.mark === 'ring') return QUADRE_HIGHLIGHT_CLASS;
    return row.state ? QUADRE_ROW_CLASSES[row.state] : '';
  }

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const maxLeft = (globalThis.innerWidth ?? PANEL_WIDTH) - PANEL_WIDTH - VIEWPORT_MARGIN;
    this.position.set({ top: rect.bottom + 4, left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)) });
    this.open.set(true);
  }

  /** The browser closed the popover (light dismiss, Escape): follow it. */
  protected onToggle(event: Event): void {
    if ((event as ToggleEvent).newState === 'closed') this.open.set(false);
  }
}
