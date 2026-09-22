import { Component, ChangeDetectionStrategy, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AttendanceStatus, NotificationTargetType } from '@muixer/shared';
import { BadgeComponent, ButtonComponent, ButtonGroupComponent, SelectComponent } from '@muixer/ui';
import { NotificationTargetValue } from '../../services/notification.service';
import { Person } from '../../../persons/models/person.model';
import { PersonSearchInputComponent } from '../../../../shared/components/forms/person-search-input/person-search-input.component';

@Component({
  selector: 'app-notification-target-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    PersonSearchInputComponent,
    BadgeComponent,
    ButtonComponent,
    ButtonGroupComponent,
    SelectComponent,
  ],
  templateUrl: './notification-target-picker.component.html',
})
export class NotificationTargetPickerComponent {
  readonly TargetType = NotificationTargetType;
  readonly AttendanceStatus = AttendanceStatus;

  target = model.required<NotificationTargetValue>();
  /** Gates the "Segons assistència" option — meaningless without a linked event to check attendance against. */
  hasLinkedEvent = input(false);

  readonly selectedPersons = signal<Person[]>([]);

  setType(type: NotificationTargetType): void {
    this.target.update((t) => ({ ...t, type }));
  }

  setAttendanceFilter(attendanceFilter: AttendanceStatus | ''): void {
    this.target.update((t) => ({ ...t, attendanceFilter: attendanceFilter || undefined }));
  }

  addPerson(person: Person): void {
    if (this.selectedPersons().some((p) => p.id === person.id)) return;
    this.selectedPersons.update((list) => [...list, person]);
    this.target.update((t) => ({ ...t, personIds: this.selectedPersons().map((p) => p.id) }));
  }

  removePerson(id: string): void {
    this.selectedPersons.update((list) => list.filter((p) => p.id !== id));
    this.target.update((t) => ({ ...t, personIds: this.selectedPersons().map((p) => p.id) }));
  }
}
