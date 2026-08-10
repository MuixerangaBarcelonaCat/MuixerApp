import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  input,
  output,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DelegateType } from '@muixer/shared';
import { UserService } from '../../../../config/services/user.service';
import { UserDto } from '../../../../config/models/user.model';
import {
  PersonDelegateService,
  PersonDelegateItem,
} from '../../../services/person-delegate.service';

@Component({
  selector: 'app-person-delegate-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './person-delegate-modal.component.html',
})
export class PersonDelegateModalComponent implements OnInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly delegateService = inject(PersonDelegateService);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  personId = input.required<string>();
  existingDelegateUserIds = input<string[]>([]);
  /** Whether this delegate is being created as the person's primary manager. */
  isPrimary = input<boolean>(false);
  /** Restricts the type selector to PARENT/GUARDIAN when set together with isPrimary (Phase 3's rule). */
  isXicalla = input<boolean>(false);

  closed = output<void>();
  saved = output<PersonDelegateItem>();

  searchTerm = signal('');
  users = signal<UserDto[]>([]);
  loadingUsers = signal(false);
  selectedUser = signal<UserDto | null>(null);
  selectedType = signal<DelegateType>(DelegateType.PARENT);
  saving = signal(false);
  error = signal<string | null>(null);

  private readonly allDelegateTypes: { value: DelegateType; label: string }[] = [
    { value: DelegateType.PARENT, label: 'Pare/Mare' },
    { value: DelegateType.PARTNER, label: 'Parella' },
    { value: DelegateType.GUARDIAN, label: 'Tutor/a' },
    { value: DelegateType.OTHER, label: 'Altres' },
  ];

  readonly delegateTypes = computed(() =>
    this.isPrimary() && this.isXicalla()
      ? this.allDelegateTypes.filter(
          (t) => t.value === DelegateType.PARENT || t.value === DelegateType.GUARDIAN,
        )
      : this.allDelegateTypes,
  );

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.loadUsers();
      });

    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    this.closed.emit();
  }

  onSearch(term: string): void {
    this.search$.next(term);
  }

  selectUser(user: UserDto): void {
    this.selectedUser.set(user);
  }

  save(): void {
    const user = this.selectedUser();
    if (!user || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);

    this.delegateService
      .createDelegate(this.personId(), {
        userId: user.id,
        delegateType: this.selectedType(),
        isPrimary: this.isPrimary(),
      })
      .subscribe({
        next: (delegate) => {
          this.saving.set(false);
          this.saved.emit(delegate);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(
            err?.error?.message ?? "Error en crear la delegació",
          );
        },
      });
  }

  private loadUsers(): void {
    this.loadingUsers.set(true);
    this.userService
      .getAll({
        search: this.searchTerm() || undefined,
        isActive: true,
        limit: 50,
      })
      .subscribe({
        next: (res) => {
          const existing = this.existingDelegateUserIds();
          this.users.set(
            res.data.filter((u) => !existing.includes(u.id)),
          );
          this.loadingUsers.set(false);
        },
        error: () => this.loadingUsers.set(false),
      });
  }
}
