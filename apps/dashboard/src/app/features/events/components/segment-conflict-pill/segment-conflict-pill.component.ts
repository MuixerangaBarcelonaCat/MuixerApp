import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ConflictPlacement, SegmentConflict } from '@muixer/pinyes-render';
import { ICON_OBSERVACIONS } from '@muixer/shared';
import { BadgeComponent } from '@muixer/ui';

let nextPopoverId = 0;

/**
 * The segment header's "N conflictes" pill, with the conflict list (who, and where each of
 * their placements is) shown on hover or keyboard focus. Read-only: resolving happens in the
 * assignment workspace's conflict panel.
 */
@Component({
  selector: 'app-segment-conflict-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, BadgeComponent],
  templateUrl: './segment-conflict-pill.component.html',
})
export class SegmentConflictPillComponent {
  readonly conflicts = input<readonly SegmentConflict[]>([]);

  readonly ICON_CONFLICT = ICON_OBSERVACIONS;
  readonly popoverId = `segment-conflict-popover-${nextPopoverId++}`;

  readonly open = signal(false);
  /**
   * Fixed, viewport-relative coordinates (top-layer popover, same approach as the color picker):
   * the segment card is `overflow-hidden`, which would clip an absolutely positioned panel.
   * Opens upwards (`bottom`) when there is more room above the pill than below it.
   */
  readonly position = signal<{ top?: number; bottom?: number; left: number } | null>(null);

  private readonly triggerRef = viewChild<ElementRef<HTMLElement>>('trigger');
  private readonly popoverRef = viewChild<ElementRef<HTMLElement>>('popoverRef');

  /** Grace period so the pointer can cross from the pill onto the list (to scroll it). */
  private static readonly CLOSE_DELAY_MS = 120;
  private static readonly POPOVER_WIDTH = 288;
  private static readonly VIEWPORT_MARGIN = 8;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly document = inject(DOCUMENT);

  /**
   * The position is computed once on open, so any scroll outside the list would leave it
   * floating away from the pill. Captured on the document because scroll doesn't bubble and
   * the page scrolls inside a container, not the window.
   */
  private readonly onScroll = (event: Event) => {
    if (this.popoverRef()?.nativeElement.contains(event.target as Node)) return;
    this.hide();
  };

  constructor() {
    // Promote into the browser's top layer once rendered (feature-detected: jsdom and older
    // browsers fall back to plain `position: fixed`). Removing the element via `@if` cleans
    // up its top-layer entry, so there is no matching hidePopover().
    effect(() => {
      if (!this.open()) return;
      const el = this.popoverRef()?.nativeElement as (HTMLElement & { showPopover?: () => void }) | undefined;
      if (el && typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
        el.showPopover();
      }
    });
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  show(): void {
    this.cancelClose();
    if (this.open()) return;
    this.position.set(this.computePosition());
    this.open.set(true);
    this.document.addEventListener('scroll', this.onScroll, true);
  }

  hide(): void {
    this.cancelClose();
    this.open.set(false);
    this.document.removeEventListener('scroll', this.onScroll, true);
  }

  scheduleHide(): void {
    this.cancelClose();
    this.closeTimer = setTimeout(() => this.hide(), SegmentConflictPillComponent.CLOSE_DELAY_MS);
  }

  cancelClose(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  areaLabel(area: ConflictPlacement['area']): string {
    return area === 'TRONC' ? 'Tronc' : area === 'PINYA' ? 'Pinya' : 'Direcció';
  }

  placementLabel(placement: ConflictPlacement): string {
    return placement.nodeLabel ? `${placement.figureName} · ${placement.nodeLabel}` : placement.figureName;
  }

  private computePosition(): { top?: number; bottom?: number; left: number } {
    const rect = this.triggerRef()?.nativeElement.getBoundingClientRect();
    if (!rect) return { top: 0, left: 0 };
    const { POPOVER_WIDTH, VIEWPORT_MARGIN } = SegmentConflictPillComponent;
    const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
    // Right-aligned with the pill, which sits at the right edge of the segment header.
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.right - POPOVER_WIDTH, maxLeft));
    const spaceBelow = window.innerHeight - rect.bottom;
    return spaceBelow >= rect.top
      ? { top: rect.bottom + 4, left }
      : { bottom: window.innerHeight - rect.top + 4, left };
  }
}
