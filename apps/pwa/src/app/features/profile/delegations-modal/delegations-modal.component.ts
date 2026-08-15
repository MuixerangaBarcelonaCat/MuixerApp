import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DelegateType } from '@muixer/shared';
import { LucideAngularModule, X, Users } from 'lucide-angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ProfileDelegate, ProfileService } from '../services/profile.service';
import { ToastService } from '../../../shared/services/toast.service';

const DELEGATE_TYPE_LABELS: Record<DelegateType, string> = {
  [DelegateType.PARENT]: 'Pare/Mare',
  [DelegateType.PARTNER]: 'Parella',
  [DelegateType.GUARDIAN]: 'Tutor/a',
  [DelegateType.OTHER]: 'Altres',
};

@Component({
  selector: 'app-delegations-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './delegations-modal.component.html',
  styleUrls: ['./delegations-modal.component.scss'],
})
export class DelegationsModalComponent {
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  personId = input.required<string>();
  closed = output<void>();

  protected readonly X = X;
  protected readonly Users = Users;
  protected readonly delegateTypes = Object.values(DelegateType);

  protected readonly delegatesResource = rxResource({
    stream: () => this.profileService.listDelegates(this.personId()),
  });
  protected readonly delegates = computed<ProfileDelegate[]>(
    () => this.delegatesResource.value() ?? [],
  );
  protected readonly isLoading = this.delegatesResource.isLoading;

  protected readonly addForm = this.fb.group({
    alias: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(20)]),
    delegateType: this.fb.nonNullable.control<DelegateType | ''>('', Validators.required),
  });
  protected readonly adding = signal(false);
  protected readonly addError = signal<string | null>(null);

  protected readonly confirmingRemoveId = signal<string | null>(null);
  protected readonly removing = signal(false);

  protected delegateTypeLabel(type: DelegateType): string {
    return DELEGATE_TYPE_LABELS[type];
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected submitAdd(): void {
    if (this.addForm.invalid || this.adding()) return;

    this.adding.set(true);
    this.addError.set(null);

    const { alias, delegateType } = this.addForm.getRawValue();
    this.profileService
      .addDelegate(this.personId(), { alias, delegateType: delegateType as DelegateType })
      .subscribe({
        next: () => {
          this.adding.set(false);
          this.addForm.reset({ alias: '', delegateType: '' });
          this.delegatesResource.reload();
        },
        error: (err: HttpErrorResponse) => {
          this.adding.set(false);
          if (err.status === 404) {
            this.addError.set('No existeix cap compte associat a aquest àlies.');
          } else if (err.status === 409) {
            this.addError.set('Aquesta persona ja té una delegació activa amb aquest compte.');
          } else if (err.status === 403) {
            this.addError.set('No teniu permís per a gestionar aquesta persona.');
          } else {
            this.addError.set("No s'ha pogut afegir la delegació. Torneu-ho a provar.");
          }
        },
      });
  }

  protected requestRemove(delegateId: string): void {
    this.confirmingRemoveId.set(delegateId);
  }

  protected cancelRemove(): void {
    this.confirmingRemoveId.set(null);
  }

  protected confirmRemove(delegateId: string): void {
    this.removing.set(true);
    this.profileService.removeDelegate(this.personId(), delegateId).subscribe({
      next: () => {
        this.removing.set(false);
        this.confirmingRemoveId.set(null);
        this.delegatesResource.reload();
      },
      error: () => {
        this.removing.set(false);
        this.toast.error("No s'ha pogut eliminar la delegació. Torneu-ho a provar.");
      },
    });
  }
}
