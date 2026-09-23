import { Component, ChangeDetectionStrategy, effect, inject, input, model, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AttendanceStatus, NotificationTargetType } from '@muixer/shared';
import { BadgeComponent, ButtonComponent, ButtonGroupComponent, SelectComponent } from '@muixer/ui';
import { NotificationTargetValue } from '../../services/notification.service';
import { Person } from '../../../persons/models/person.model';
import { PersonService } from '../../../persons/services/person.service';
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

  private readonly personService = inject(PersonService);
  /** Ids already fetched (or being fetched) — keeps the hydration effect from looping on its own
   *  writes, and from re-requesting a person while their request is still in flight. */
  private readonly resolvedIds = new Set<string>();

  constructor() {
    // An edit arrives with `personIds` alone, so the chips would start empty and the next added
    // person would overwrite the rest. Resolve the ids to real persons before that can happen.
    effect(() => {
      const ids = this.target().personIds ?? [];
      const missing = ids.filter((id) => !this.resolvedIds.has(id));
      if (missing.length === 0) return;

      missing.forEach((id) => this.resolvedIds.add(id));
      forkJoin(missing.map((id) => this.personService.getOne(id))).subscribe({
        next: (persons) => this.selectedPersons.update((list) => [...list, ...persons]),
        error: () => missing.forEach((id) => this.resolvedIds.delete(id)),
      });
    });
  }

  setType(type: NotificationTargetType): void {
    this.target.update((t) => ({ ...t, type }));
  }

  setAttendanceFilter(attendanceFilter: AttendanceStatus | ''): void {
    this.target.update((t) => ({ ...t, attendanceFilter: attendanceFilter || undefined }));
  }

  addPerson(person: Person): void {
    if (untracked(this.selectedPersons).some((p) => p.id === person.id)) return;
    this.resolvedIds.add(person.id);
    this.selectedPersons.update((list) => [...list, person]);
    this.target.update((t) => ({ ...t, personIds: this.selectedPersons().map((p) => p.id) }));
  }

  removePerson(id: string): void {
    this.resolvedIds.delete(id);
    this.selectedPersons.update((list) => list.filter((p) => p.id !== id));
    this.target.update((t) => ({ ...t, personIds: this.selectedPersons().map((p) => p.id) }));
  }
}
