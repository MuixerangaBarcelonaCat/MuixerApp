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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceItem, AttendanceCrudResponse, AttendanceDeleteResponse } from '../../models/attendance.model';
import { AttendanceStatus } from '@muixer/shared';

@Component({
  selector: 'app-attendance-edit-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance-edit-modal.component.html',
  styleUrls: ['./attendance-edit-modal.component.scss'],
})
export class AttendanceEditModalComponent implements OnChanges {
  private readonly attendanceService = inject(AttendanceService);

  readonly AttendanceStatus = AttendanceStatus;

  attendance = input.required<AttendanceItem>();
  eventId = input.required<string>();
  isPast = input(false);

  saved = output<AttendanceCrudResponse>();
  deleted = output<AttendanceDeleteResponse>();
  closed = output<void>();

  selectedStatus = signal<AttendanceStatus>(AttendanceStatus.PENDENT);
  editedNotes = signal<string | null>(null);
  saving = signal(false);
  deleting = signal(false);
  showDeleteConfirm = signal(false);
  errorMessage = signal<string | null>(null);

  ngOnChanges() {
    const att = this.attendance();
    this.selectedStatus.set(att.status);
    this.editedNotes.set(att.notes);
    this.showDeleteConfirm.set(false);
    this.errorMessage.set(null);
  }

  hasChanges = computed(() => {
    const att = this.attendance();
    return (
      this.selectedStatus() !== att.status ||
      this.editedNotes() !== att.notes
    );
  });

  showWarning = computed(() =>
    this.isPast() && this.selectedStatus() !== this.attendance().status,
  );

  statusButtonClass(status: AttendanceStatus): string {
    const isSelected = this.selectedStatus() === status;
    const base = 'btn btn-sm';
    const map: Record<AttendanceStatus, string> = {
      [AttendanceStatus.ANIRE]: isSelected ? 'btn-success' : 'btn-outline btn-success',
      [AttendanceStatus.NO_VAIG]: isSelected ? 'btn-error' : 'btn-outline btn-error',
      [AttendanceStatus.PENDENT]: isSelected ? 'btn-ghost btn-active' : 'btn-ghost',
      [AttendanceStatus.ASSISTIT]: isSelected ? 'btn-success' : 'btn-outline btn-success',
      [AttendanceStatus.NO_PRESENTAT]: isSelected ? 'btn-warning' : 'btn-outline btn-warning',
    };
    return `${base} ${map[status] ?? ''}`;
  }

  statusLabel(status: AttendanceStatus): string {
    const past = this.isPast();
    const labels: Record<AttendanceStatus, string> = {
      [AttendanceStatus.PENDENT]: 'Pendent',
      [AttendanceStatus.ANIRE]: 'Aniré',
      [AttendanceStatus.NO_VAIG]: past ? 'No va anar' : 'No vaig',
      [AttendanceStatus.ASSISTIT]: 'Assistit',
      [AttendanceStatus.NO_PRESENTAT]: 'No presentat',
    };
    return labels[status] ?? status;
  }

  onSave() {
    if (!this.hasChanges() || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);

    this.attendanceService
      .update(this.eventId(), this.attendance().id, {
        status: this.selectedStatus(),
        notes: this.editedNotes(),
      })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.saved.emit(result);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(err?.error?.message ?? 'Error en desar els canvis');
        },
      });
  }

  onDelete() {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.errorMessage.set(null);

    this.attendanceService.remove(this.eventId(), this.attendance().id).subscribe({
      next: (result) => {
        this.deleting.set(false);
        this.deleted.emit(result);
      },
      error: (err) => {
        this.deleting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Error en eliminar el registre');
      },
    });
  }

  onClose() {
    this.closed.emit();
  }
}
