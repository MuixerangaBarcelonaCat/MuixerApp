import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { LucideIconData } from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';

export interface TabDef {
  id: string;
  label: string;
  icon?: LucideIconData;
}

/**
 * `role="tablist"` nav (DaisyUI `.tabs.tabs-boxed` pills) driven by a data array of `TabDef`s and
 * one `activeId`/`(activeIdChange)` pair — the shared shape behind the dashboard's segment-workspace
 * and event-detail tab strips and the PWA's Propers/Passats filter, unified here so all three (plus
 * the template editor's Pinya/Rengles/Tronc mode switcher, visually the same control even though it
 * drives a mode rather than a tabpanel) look and behave identically. Owns the `tablist` nav only —
 * not content switching: the caller still decides how to mount/hide/lazy-render whatever `activeId`
 * points at (matching `lib-button-group`'s "caller drives it" philosophy, see DESIGN_SYSTEM.md).
 * Internalizes the WAI-ARIA roving-tabindex keyboard pattern (Left/Right/Home/End) that only the PWA
 * had before this component existed, so every consumer gains it uniformly.
 */
@Component({
  selector: 'lib-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],
})
export class TabsComponent {
  tabs = input.required<TabDef[]>();
  activeId = input.required<string>();

  // Distinct from `variant` naming elsewhere (e.g. lib-badge/lib-button) since DaisyUI's own
  // modifier classes for `.tabs` are literally `tabs-boxed`/`tabs-bordered` — kept 1:1 with those.
  style = input<'boxed' | 'bordered'>('boxed');

  ariaLabel = input<string>('');

  // Optional `data-testid="{prefix}-{tab.id}"` per button — some call sites (event-detail) already
  // had per-tab test ids their specs query by; kept opt-in so the two data-driven consumers without
  // one don't grow attributes nobody reads.
  testIdPrefix = input<string>('');

  // `aria-controls` target id per tab — defaults to the generic `tabpanel-{id}` but overridable
  // since event-detail's panels were already ids `event-tabpanel-{id}` before this component existed.
  panelIdPrefix = input<string>('tabpanel-');

  activeIdChange = output<string>();

  protected select(id: string): void {
    if (id !== this.activeId()) {
      this.activeIdChange.emit(id);
    }
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const navigationKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!navigationKeys.includes(event.key)) return;
    event.preventDefault();

    const tabs = this.tabs();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;

    this.select(tabs[nextIndex].id);
    const buttons = (event.target as HTMLElement)
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  }
}
