import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { BadgeComponent, ButtonComponent } from '@muixer/ui';
import 'emoji-picker-element';
import type { EmojiClickEventDetail } from 'emoji-picker-element/shared';

/** Pinned at the top of the picker so the most-used flags are always one click away. */
const COMMON_EMOJIS = ['⚠️', '🚨', '👁️', '❗', '🤕'];

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent, BadgeComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './emoji-picker.component.html',
})
export class EmojiPickerComponent {
  readonly value = input<string | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<string | null>();

  readonly open = signal(false);
  readonly commonEmojis = COMMON_EMOJIS;

  private readonly wrapper = viewChild<ElementRef<HTMLElement>>('wrapper');

  toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
  }

  select(emoji: string | null): void {
    this.valueChange.emit(emoji);
    this.open.set(false);
  }

  onEmojiClick(event: Event): void {
    const detail = (event as CustomEvent<EmojiClickEventDetail>).detail;
    if (detail?.unicode) {
      this.select(detail.unicode);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const el = this.wrapper()?.nativeElement;
    if (el && !el.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
