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
