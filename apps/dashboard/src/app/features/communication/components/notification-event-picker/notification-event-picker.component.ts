import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { EventReferenceKind } from '@muixer/shared';
import { SelectComponent } from '@muixer/ui';
import { EventReferenceValue } from '../../services/notification.service';
import { EventListItem } from '../../../events/models/event.model';

@Component({
  selector: 'app-notification-event-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SlicePipe, SelectComponent],
  templateUrl: './notification-event-picker.component.html',
})
export class NotificationEventPickerComponent {
  readonly EventRefKind = EventReferenceKind;

  linkedEvent = model<EventReferenceValue | undefined>(undefined);
  events = input.required<EventListItem[]>();
  allowTriggeringEvent = input(false);
  /** "schedule" swaps "Pròxima"/"Pròxim" for "Següent" — the notification hasn't been sent yet
   *  when the schedule form is filled in, so "next" reads more naturally than "upcoming". */
  variant = input<'send' | 'schedule'>('send');

  setKind(kind: EventReferenceKind | ''): void {
    if (!kind) {
      this.linkedEvent.set(undefined);
      return;
    }
    this.linkedEvent.set({ kind, eventId: kind === EventReferenceKind.SPECIFIC ? this.linkedEvent()?.eventId : undefined });
  }

  setSpecificEventId(eventId: string): void {
    this.linkedEvent.set({ kind: EventReferenceKind.SPECIFIC, eventId });
  }
}
