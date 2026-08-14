import { ConflictPlacement, SegmentConflict, SegmentNodeRef, targetTabForZone } from '@muixer/pinyes-render';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ChevronLeft, ChevronRight, Eye, LucideAngularModule, Trash2 } from 'lucide-angular';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { SegmentWorkspaceStateService } from '../../services/segment-workspace-state.service';
import { ConflictResolutionService } from '../../services/conflict-resolution.service';

/** Card width (w-72 = 288px) + gap-3 (12px) = 300px per scroll step. */
const CARD_SCROLL_STEP = 300;

/**
 * Banner + expandable panel for the canonical segment conflicts (D13, Fase 4). Mounted once at
 * the workspace level (visible on every tab). Since Fase 5 dropped the uniqueness constraints
 * that made duplicates impossible, `ws.conflicts()`/`conflictCounters()` can be non-empty.
 *
 * A single warning style covers every conflict `kind` — "un conflicte és un conflicte" (§4.1) —
 * and rows stay in the server's TRONC_TRONC → TRONC_PINYA → PINYA_PINYA order (never re-sorted).
 */
@Component({
  selector: 'app-segment-conflict-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './segment-conflict-panel.component.html',
})
export class SegmentConflictPanelComponent {
  readonly ws = inject(SegmentWorkspaceStateService);
  private readonly resolution = inject(ConflictResolutionService);

  readonly placementSelected = output<{ tab: 'pinyes' | 'troncs'; ref: SegmentNodeRef }>();

  readonly ICON_CONFLICT = DOMAIN_ICONS.OBSERVACIONS;
  readonly Eye = Eye;
  readonly Trash2 = Trash2;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

  readonly panelOpen = signal(false);
  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);

  readonly conflicts = computed(() => this.ws.conflicts());
  readonly conflictPersonCount = computed(() => this.ws.conflictCounters()?.conflictPersonCount ?? 0);
  readonly freedPinyaNodeIds = computed(() => this.ws.reviewItems().freedPinyaNodeIds);

  /** Labels of the freed pinya nodes still pending review, resolved from the loaded instances. */
  readonly freedPinyaNodeLabels = computed(() => {
    const ids = new Set(this.freedPinyaNodeIds());
    if (ids.size === 0) return [];
    const labels: string[] = [];
    for (const instance of this.ws.instances()) {
      for (const node of instance.nodes) {
        if (ids.has(node.id)) labels.push(`${instance.label} — ${node.label}`);
      }
    }
    return labels;
  });

  togglePanel(): void {
    this.panelOpen.update((v) => !v);
    if (this.panelOpen()) {
      setTimeout(() => this.updateScrollState(), 0);
    } else {
      this.canScrollLeft.set(false);
      this.canScrollRight.set(false);
    }
  }

  dismissReview(): void {
    this.ws.reviewItems.set({ freedPinyaNodeIds: [] });
  }

  areaLabel(area: ConflictPlacement['area']): string {
    return area === 'TRONC' ? 'Tronc' : area === 'PINYA' ? 'Pinya' : 'Direcció';
  }

  hasTroncSuggestion(conflict: SegmentConflict): boolean {
    return conflict.kind === 'TRONC_PINYA';
  }

  selectPlacement(placement: ConflictPlacement): void {
    const tab = targetTabForZone(placement.zone) ?? 'pinyes';
    this.placementSelected.emit({ tab, ref: { slotId: placement.figureInstanceId, nodeId: placement.nodeId } });
  }

  removePlacement(personId: string, placement: ConflictPlacement): void {
    this.resolution.removePlacement(personId, placement);
  }

  releaseSuggested(conflict: SegmentConflict): void {
    this.resolution.releaseSuggested(conflict);
  }

  removeTroncSide(conflict: SegmentConflict): void {
    this.resolution.removeTroncSide(conflict);
  }

  onScroll(): void {
    this.updateScrollState();
  }

  scrollPrev(): void {
    this.scrollContainer()?.nativeElement.scrollBy({ left: -CARD_SCROLL_STEP, behavior: 'smooth' });
  }

  scrollNext(): void {
    this.scrollContainer()?.nativeElement.scrollBy({ left: CARD_SCROLL_STEP, behavior: 'smooth' });
  }

  private updateScrollState(): void {
    const el = this.scrollContainer()?.nativeElement;
    if (!el) return;
    this.canScrollLeft.set(el.scrollLeft > 0);
    this.canScrollRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }
}
