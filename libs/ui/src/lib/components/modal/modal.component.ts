import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, computed, effect, input, output, viewChild } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';

export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | '2xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  '2xl': 'max-w-2xl',
};

let nextId = 0;

@Component({
  selector: 'lib-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
})
export class ModalComponent {
  protected readonly XIcon = X;

  open = input(false);
  title = input<string>();
  size = input<ModalSize>('md');
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
    ['modal-box', 'flex', 'flex-col', 'max-h-[85vh]', SIZE_CLASSES[this.size()]].join(' '),
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
