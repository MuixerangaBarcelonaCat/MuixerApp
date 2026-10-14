import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { LucideAngularModule, Smile } from 'lucide-angular';
import 'emoji-picker-element';
import type { EmojiClickEventDetail } from 'emoji-picker-element/shared';
import { ButtonComponent } from '../button/button.component';

/**
 * Toolbar action that drops an emoji at the caret. Shares the `emoji-picker-element` web component
 * with the dashboard's own `app-emoji-picker`, but not its shape: that one is a field that holds a
 * single value, this one is a one-shot insert. Kept in this folder, and out of the `@muixer/ui`
 * barrel, so the library only loads with the editor that uses it.
 *
 * The panel is rendered through a CDK overlay rather than positioned inside this component: the
 * editor's wrapper is `overflow-hidden` to round its corners, and the app shell clips to the
 * viewport, so an in-place panel gets cut off whenever the editor is short. The overlay lives in a
 * body-level container instead, and flips above the button when there is no room below.
 *
 * `CUSTOM_ELEMENTS_SCHEMA` is scoped to this small component on purpose — applying it to the
 * editor's own template would switch off element checking for the whole toolbar.
 */
@Component({
  selector: 'lib-emoji-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayModule, LucideAngularModule, ButtonComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './emoji-button.component.html',
})
export class EmojiButtonComponent {
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly picked = output<string>();

  protected readonly Smile = Smile;
  protected readonly open = signal(false);

  private readonly wrapper = viewChild<ElementRef<HTMLElement>>('wrapper');

  /** Below the button by preference, above it when the viewport leaves no room. */
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((isOpen) => !isOpen);
  }

  protected onEmojiClick(event: Event): void {
    const detail = (event as CustomEvent<EmojiClickEventDetail>).detail;
    if (!detail?.unicode) return;
    this.picked.emit(detail.unicode);
    this.open.set(false);
  }

  protected onOutsideClick(event: MouseEvent): void {
    // The trigger counts as "outside" the overlay, so ignore it here and let `toggle()` close the
    // panel — otherwise the two would fight and a second click would close then reopen.
    if (this.wrapper()?.nativeElement.contains(event.target as Node)) return;
    this.open.set(false);
  }
}
