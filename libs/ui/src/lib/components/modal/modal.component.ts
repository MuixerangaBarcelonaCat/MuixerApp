import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, computed, effect, input, output, viewChild } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';

export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | '2xl' | '4xl' | 'full';

const SIZE_CLASSES: Record<ModalSize, string> = {
  // dvh, not vh: on phones 100vh is taller than the visible area, so the box overflowed it.
  xs: 'max-w-xs max-h-[85dvh]',
  sm: 'max-w-sm max-h-[85dvh]',
  md: 'max-w-md max-h-[85dvh]',
  lg: 'max-w-lg max-h-[85dvh]',
  '2xl': 'max-w-2xl max-h-[85dvh]',
  '4xl': 'max-w-4xl max-h-[85dvh]',
  /** Near-fullscreen, for dense read-only views (e.g. the quadre de troncs). */
  full: 'w-11/12 max-w-none h-[90dvh] max-h-[90dvh]',
};

/** `top` is for modals that open the on-screen keyboard: a centred box ends up behind it (the
 *  keyboard doesn't shrink the layout viewport on iOS, nor on Android by default), so the content
 *  under the input — e.g. search results — was hidden. Anchored at the top it stays visible. */
export type ModalPlacement = 'middle' | 'top';

const PLACEMENT_CLASSES: Record<ModalPlacement, string> = {
  middle: 'modal',
  top: 'modal items-start pt-[calc(env(safe-area-inset-top,0px)+1rem)]',
};

let nextId = 0;

@Component({
  selector: 'lib-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
})
export class ModalComponent {
  protected readonly XIcon = X;

  open = input(false);
  title = input<string>();
  size = input<ModalSize>('md');
  placement = input<ModalPlacement>('middle');
  protected readonly dialogClasses = computed(() => PLACEMENT_CLASSES[this.placement()]);
  dismissible = input(true, { transform: booleanAttribute });
  // Undefined means "inherit from dismissible" — a dismissible modal gets a close button unless
  // explicitly opted out, a non-dismissible one never gets one (see the constructor invariant).
  showCloseButton = input<boolean>();

  closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialogEl');
  private readonly generatedId = `lib-modal-${++nextId}`;

  protected readonly titleId = computed(() => (this.title() ? `${this.generatedId}-title` : null));
  protected readonly effectiveShowCloseButton = computed(() => this.showCloseButton() ?? this.dismissible());
  protected readonly boxClasses = computed(() =>
    ['modal-box', 'flex', 'flex-col', SIZE_CLASSES[this.size()]].join(' '),
  );

  constructor() {
    effect(() => {
      if (this.showCloseButton() === true && !this.dismissible()) {
        throw new Error(
          'lib-modal: showCloseButton cannot be true when dismissible is false — a modal with no Escape/backdrop dismissal should not offer a close button either.',
        );
      }
    });

    effect(() => {
      const dialogEl = this.dialog().nativeElement;
      if (this.open()) {
        if (!dialogEl.open) {
          dialogEl.showModal();
        }
      } else if (dialogEl.open) {
        dialogEl.close();
      }
    });
  }

  protected onDialogClick(event: MouseEvent): void {
    if (this.dismissible() && event.target === event.currentTarget) {
      this.dialog().nativeElement.close();
    }
  }

  protected onCancel(event: Event): void {
    if (!this.dismissible()) {
      event.preventDefault();
    }
  }

  protected onNativeClose(): void {
    this.closed.emit();
  }

  protected closeFromButton(): void {
    this.dialog().nativeElement.close();
  }
}
