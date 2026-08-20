import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  ElementRef,
  viewChild,
  HostListener,
  computed,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-color-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './color-picker.component.html',
})
export class ColorPickerComponent {
  color = input<string | null>(null);
  presetColors = input<string[]>([]);
  colorChange = output<string>();

  dropdownOpen = signal(false);

  /** Temporary hex input value while the popover is open */
  readonly hexInput = signal('');

  /**
   * Popover is positioned via `position: fixed` from the swatch's viewport coordinates rather
   * than `position: absolute` — several call sites embed this component inside panels with
   * `overflow: auto/hidden` (properties sidebars, scrollable lists), which would otherwise clip
   * the popover to invisibility instead of just anchoring it.
   */
  readonly popoverPosition = signal<{ top: number; left: number } | null>(null);

  readonly swatchRef = viewChild<ElementRef<HTMLElement>>('swatchRef');
  readonly dropdownRef = viewChild<ElementRef<HTMLElement>>('dropdownRef');

  readonly normalizedHex = computed(() => {
    const v = this.hexInput().trim();
    return v.startsWith('#') ? v : '#' + v;
  });

  readonly isValidHex = computed(() => /^#[0-9A-Fa-f]{6}$/.test(this.normalizedHex()));

  private static readonly POPOVER_WIDTH = 190;
  private static readonly VIEWPORT_MARGIN = 8;

  constructor() {
    // Promotes the popover into the browser's top layer (Popover API) the moment `@if` adds it
    // to the DOM. Two real bugs otherwise show up whenever this component is nested inside
    // `lib-modal`: DaisyUI's `.modal-box` always carries a `transform` (its own open/close scale
    // animation, present even at rest as an identity transform) — any `transform`, including an
    // identity one, redefines the containing block for `position: fixed` descendants away from
    // the viewport, so the popover's viewport-relative `top`/`left` (from `computePopoverPosition`
    // below) land far from the trigger; and `lib-modal`'s scrollable body (`overflow-y-auto`)
    // still clips a `fixed` descendant during paint even though its layout position ignores
    // scrolling. Top-layer elements use the viewport as their containing block and are exempt
    // from ancestor overflow clipping, fixing both. `manual` (not `auto`) mode is deliberate: this
    // component already drives open/close itself (`dropdownOpen`, the document click/Escape
    // listeners below) — `auto` mode's own native light-dismiss would race with that. No need to
    // call `hidePopover()` on close: removing a shown popover element from the DOM (which `@if`
    // already does) auto-cleans up its top-layer entry. Feature-detected so browsers without the
    // Popover API fall back to the pre-existing (viewport-relative, non-top-layer) behavior.
    effect(() => {
      if (!this.dropdownOpen()) return;
      const el = this.dropdownRef()?.nativeElement as (HTMLElement & { showPopover?: () => void }) | undefined;
      if (el && typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
        el.showPopover();
      }
    });
  }

  toggleDropdown(): void {
    if (this.dropdownOpen()) {
      this.dropdownOpen.set(false);
    } else {
      this.hexInput.set(this.color() ?? '');
      this.popoverPosition.set(this.computePopoverPosition());
      this.dropdownOpen.set(true);
    }
  }

  private computePopoverPosition(): { top: number; left: number } {
    const rect = this.swatchRef()?.nativeElement.getBoundingClientRect();
    if (!rect) return { top: 0, left: 0 };
    const maxLeft = window.innerWidth - ColorPickerComponent.POPOVER_WIDTH - ColorPickerComponent.VIEWPORT_MARGIN;
    return {
      top: rect.bottom + 4,
      left: Math.max(ColorPickerComponent.VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)),
    };
  }

  selectColor(hex: string): void {
    this.colorChange.emit(hex);
    this.dropdownOpen.set(false);
  }

  onHexBlur(): void {
    let val = this.hexInput().trim();
    if (val.length > 0 && !val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      this.colorChange.emit(val.toUpperCase());
    }
  }

  onHexInput(value: string): void {
    this.hexInput.set(value);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dropdownOpen()) this.dropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.dropdownOpen()) return;
    const swatch = this.swatchRef()?.nativeElement;
    const dropdown = this.dropdownRef()?.nativeElement;
    const target = event.target as Node;
    if (!swatch?.contains(target) && !dropdown?.contains(target)) {
      this.dropdownOpen.set(false);
    }
  }
}
