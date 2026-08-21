import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Thin `.join` layout wrapper around a row (or column) of `lib-button`s with `joinItem` set —
 * groups their corners (first/last rounded, middle ones square) into one visually joined control,
 * DaisyUI's own segmented-control pattern. Pure layout: no shared selection state, no ARIA
 * `role="group"`/`tablist` wiring — the caller drives each button's own `active`/`(clicked)` (see
 * DESIGN_SYSTEM.md for the full rationale and the two call-site patterns this replaces).
 */
@Component({
  selector: 'lib-button-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './button-group.component.html',
  styleUrls: ['./button-group.component.scss'],
})
export class ButtonGroupComponent {
  vertical = input(false, { transform: booleanAttribute });
}
