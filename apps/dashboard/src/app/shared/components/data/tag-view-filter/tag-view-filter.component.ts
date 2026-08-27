import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TAG_CATEGORY_LABELS, TagCategory } from '@muixer/shared';
import { ButtonComponent, ButtonGroupComponent } from '@muixer/ui';

// Matches the tag catalog table's own group order (config/tags), not the enum's declaration
// order — keeps the taxonomy reading the same everywhere in the UI.
const GROUP_ORDER: readonly TagCategory[] = [TagCategory.PINYA, TagCategory.TRONC, TagCategory.XICALLA, TagCategory.ALTRES];

/**
 * Selector de grups d'etiquetes. Selecció buida = tots els grups.
 *
 * `groups` restringeix quins s'ofereixen: el panell d'assignació només deixa filtrar per Pinya
 * i Tronc, perquè la xicalla ja té la seua pròpia casella al costat i la gent d'«Altres» no se
 * sol col·locar a les figures.
 */
@Component({
  selector: 'app-tag-view-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ButtonGroupComponent],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <lib-button-group>
        @for (group of groups(); track group) {
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

  readonly groups = input<readonly TagCategory[]>(GROUP_ORDER);

  readonly labels = TAG_CATEGORY_LABELS;

  toggleGroup(group: TagCategory): void {
    const current = this.selected();
    this.selectedChange.emit(
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group],
    );
  }
}
