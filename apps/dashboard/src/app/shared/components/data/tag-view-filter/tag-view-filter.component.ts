import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TAG_CATEGORY_LABELS, TAG_VIEWS, TagCategory, TagView } from '@muixer/shared';
import { ButtonComponent, ButtonGroupComponent } from '@muixer/ui';

// Matches the tag catalog table's own group order (config/tags), not the enum's declaration
// order — keeps the taxonomy reading the same everywhere in the UI.
const GROUP_ORDER: readonly TagCategory[] = [TagCategory.PINYA, TagCategory.TRONC, TagCategory.XICALLA, TagCategory.ALTRES];

/**
 * Selector de grups d'etiquetes amb les dues visualitzacions de la tècnica: «Guió»
 * (xicalla + tronc) i «Pinyes» (pinya + altres). Selecció buida = tots els grups.
 */
@Component({
  selector: 'app-tag-view-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ButtonGroupComponent],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <lib-button-group>
        @for (view of views; track view.id) {
          <lib-button
            joinItem
            size="sm"
            variant="primary"
            [active]="isViewActive(view.id)"
            (clicked)="applyView(view.id)"
          >{{ view.label }}</lib-button>
        }
      </lib-button-group>

      <span class="divider divider-horizontal mx-0" aria-hidden="true"></span>

      <lib-button-group>
        @for (group of groups; track group) {
          <lib-button
            joinItem
            outlineMode
            size="sm"
            variant="neutral"
            [active]="selected().includes(group)"
            (clicked)="toggleGroup(group)"
          >{{ labels[group] }}</lib-button>
        }
      </lib-button-group>
    </div>
  `,
})
export class TagViewFilterComponent {
  readonly selected = input.required<TagCategory[]>();
  readonly selectedChange = output<TagCategory[]>();

  readonly views = TAG_VIEWS;
  readonly groups = GROUP_ORDER;
  readonly labels = TAG_CATEGORY_LABELS;

  private readonly selectedSet = computed(() => new Set(this.selected()));

  isViewActive(id: TagView['id']): boolean {
    const view = TAG_VIEWS.find((v) => v.id === id);
    if (!view) return false;
    const current = this.selectedSet();
    return current.size === view.groups.length && view.groups.every((g) => current.has(g));
  }

  applyView(id: TagView['id']): void {
    const view = TAG_VIEWS.find((v) => v.id === id);
    if (!view) return;
    this.selectedChange.emit(this.isViewActive(id) ? [] : [...view.groups]);
  }

  toggleGroup(group: TagCategory): void {
    const current = this.selected();
    this.selectedChange.emit(
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group],
    );
  }
}
