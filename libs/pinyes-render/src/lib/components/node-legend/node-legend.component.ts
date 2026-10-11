import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Info, LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '@muixer/ui';
import { EventPhase, FigureZone } from '@muixer/shared';
import { injectCanvasTheme } from '../../theme/inject-canvas-theme';
import { attendanceLegend } from '../../node-render/attendance';
import { NodeAppearance, NodeAppearanceInput, resolveNodeAppearance } from '../../node-render/appearance';
import { NodeDrawingComponent } from '../node-drawing/node-drawing.component';

/** Width of the panel (w-72), to keep it inside the viewport. */
const PANEL_WIDTH = 288;
const VIEWPORT_MARGIN = 8;

let nextLegendId = 0;

export interface LegendEntry {
  section: 'attendance' | 'marks';
  label: string;
  appearance: NodeAppearance;
}

/**
 * «Llegenda» button and popover for the figure views: what the node fills (attendance, worded for
 * the phase) and marks mean. Every sample is drawn with `app-node-drawing`, the same renderer as
 * the tronc panel, so the legend can't drift from what the figure shows.
 */
@Component({
  selector: 'app-node-legend',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, LucideAngularModule, NodeDrawingComponent],
  template: `
    <span #trigger class="inline-flex">
      <lib-button variant="ghost" size="xs" [ariaExpanded]="open()" [ariaControls]="panelId" (clicked)="toggle()">
        <lucide-icon [img]="Info" [size]="14" aria-hidden="true" />
        Llegenda
      </lib-button>
    </span>
    @if (open()) {
      <!-- inset-auto m-0 cancel the [popover] UA centring, so top/left apply (as in the conflict pill). -->
      <div
        #panel
        popover="auto"
        role="dialog"
        aria-label="Llegenda"
        [id]="panelId"
        class="fixed inset-auto m-0 z-dropdown w-72 max-h-96 overflow-y-auto bg-base-100 border border-base-300 rounded-box shadow-overlay p-3 text-sm text-base-content"
        [style.top.px]="position().top"
        [style.left.px]="position().left"
        (toggle)="onToggle($event)"
        (keydown.escape)="open.set(false)"
        data-testid="node-legend"
      >
        @for (section of sections; track section.key) {
          <h3 class="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-1" [class.mt-3]="!$first">
            {{ section.title }}
          </h3>
          <ul class="flex flex-col gap-1">
            @for (entry of entriesOf(section.key); track entry.label) {
              <li class="flex items-center gap-3">
                <span class="relative shrink-0 w-16 h-8 m-3" aria-hidden="true">
                  <app-node-drawing [appearance]="entry.appearance" />
                </span>
                <span>{{ entry.label }}</span>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class NodeLegendComponent {
  readonly phase = input<EventPhase>('before');
  /** `neutral` for the tronc panel, which draws every node in the paper tone. */
  readonly palette = input<'type' | 'neutral'>('type');

  protected readonly Info = Info;
  protected readonly panelId = `node-legend-${nextLegendId++}`;
  protected readonly sections = [
    { key: 'attendance' as const, title: 'Assistència' },
    { key: 'marks' as const, title: 'Marques' },
  ];

  private readonly theme = injectCanvasTheme();
  protected readonly open = signal(false);
  protected readonly position = signal({ top: 0, left: 0 });
  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement & { showPopover?: () => void }>>('panel');

  readonly entries = computed<LegendEntry[]>(() => {
    const base: NodeAppearanceInput = {
      zone: FigureZone.PINYA,
      positionType: 'vents',
      color: null,
      label: 'Vent',
      palette: this.palette(),
      mode: 'workspace',
    };
    const person = { name: 'Marta' };
    const theme = this.theme();
    const draw = (input: Partial<NodeAppearanceInput>) => resolveNodeAppearance({ ...base, person, ...input }, theme);
    return [
      ...attendanceLegend(this.phase()).map(({ fill, label }) => ({
        section: 'attendance' as const,
        label,
        appearance: draw({ attendance: fill }),
      })),
      { section: 'attendance', label: 'Posició buida', appearance: draw({ person: null }) },
      { section: 'marks', label: 'Ve a la propera actuació', appearance: draw({ person: { ...person, nextActuacio: true } }) },
      { section: 'marks', label: 'Té observacions', appearance: draw({ person: { ...person, observation: { emoji: '🤕' } } }) },
      { section: 'marks', label: "En conflicte: ocupa més d'una posició en este segment", appearance: draw({ conflict: true }) },
      { section: 'marks', label: "S'està movent", appearance: draw({ moveSource: true }) },
      { section: 'marks', label: 'Node extra', appearance: draw({ isAdHoc: true }) },
    ];
  });

  constructor() {
    // Native popover where the browser has it: top layer, light dismiss and Escape for free.
    afterRenderEffect(() => {
      const el = this.panel()?.nativeElement;
      if (el && typeof el.showPopover === 'function' && !el.matches(':popover-open')) el.showPopover();
    });
  }

  protected entriesOf(section: LegendEntry['section']): LegendEntry[] {
    return this.entries().filter((e) => e.section === section);
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
