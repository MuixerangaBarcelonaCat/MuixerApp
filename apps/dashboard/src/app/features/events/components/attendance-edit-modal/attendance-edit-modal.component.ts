import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  OnChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertComponent, ButtonComponent, ModalComponent, TextareaComponent } from '@muixer/ui';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceItem, AttendanceCrudResponse } from '../../models/attendance.model';

/**
 * Notes-only editor for a person's attendance to an event. The status is changed inline in the
 * attendance list; this modal only holds the free-text notes.
 */
@Component({
  selector: 'app-attendance-edit-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AlertComponent, ButtonComponent, ModalComponent, TextareaComponent],
  templateUrl: './attendance-edit-modal.component.html',
})
export class AttendanceEditModalComponent implements OnChanges {
  private readonly attendanceService = inject(AttendanceService);

  attendance = input.required<AttendanceItem>();
  eventId = input.required<string>();

  saved = output<AttendanceCrudResponse>();
  closed = output<void>();

  editedNotes = signal<string | null>(null);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  ngOnChanges() {
    this.editedNotes.set(this.attendance().notes);
    this.errorMessage.set(null);
  }

  hasChanges = computed(() => this.editedNotes() !== this.attendance().notes);

  onSave() {
    if (!this.hasChanges() || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);

    this.attendanceService
      .set(this.eventId(), this.attendance().person.id, { notes: this.editedNotes() })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.saved.emit(result);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(err?.error?.message ?? "No s'han pogut alçar les notes.");
        },
      });
  }

  onClose() {
    this.closed.emit();
  }
}
