import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { ClientType, UserPushDevice, UserSession } from '@muixer/shared';
import { AlertComponent, BadgeComponent, ButtonComponent, EmptyStateComponent, ModalComponent, ToastService } from '@muixer/ui';
import { UserDevicesService } from '../../services/user-devices.service';

const BROWSERS: [string, string][] = [
  ['Edg/', 'Edge'],
  ['Firefox/', 'Firefox'],
  ['Chrome/', 'Chrome'],
  ['Safari/', 'Safari'],
];
// iOS before macOS: iPhone/iPad user agents also say "Mac OS X"; Android before Linux for the same reason.
const SYSTEMS: [string, string][] = [
  ['Android', 'Android'],
  ['iPhone', 'iOS'],
  ['iPad', 'iOS'],
  ['Windows', 'Windows'],
  ['Mac OS X', 'macOS'],
  ['Linux', 'Linux'],
];

/** Timestamps of the devices list and modal. */
export const DEVICE_DATE_FORMAT = 'dd/MM/yyyy HH:mm';

/** Short «navegador · sistema» label from a user agent; simple substring rules, not a full parser. */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Dispositiu desconegut';
  const parts = [BROWSERS, SYSTEMS]
    .map((rules) => rules.find(([needle]) => ua.includes(needle))?.[1])
    .filter((p): p is string => !!p);
  return parts.length ? parts.join(' · ') : 'Dispositiu desconegut';
}

@Component({
  selector: 'app-user-devices-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, AlertComponent, BadgeComponent, ButtonComponent, EmptyStateComponent, ModalComponent],
  templateUrl: './user-devices-modal.component.html',
})
export class UserDevicesModalComponent implements OnInit {
  readonly userId = input.required<string>();
  readonly userLabel = input<string>('');
  readonly closed = output<void>();

  private readonly api = inject(UserDevicesService);
  private readonly toast = inject(ToastService);

  readonly ClientType = ClientType;
  readonly describe = describeUserAgent;
  readonly dateFormat = DEVICE_DATE_FORMAT;

  readonly sessions = signal<UserSession[]>([]);
  readonly devices = signal<UserPushDevice[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly busy = signal(false);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const id = this.userId();
    let pending = 2;
    const done = () => {
      if (--pending === 0) this.loading.set(false);
    };
    const fail = () => {
      this.error.set(true);
      done();
    };
    this.api.sessions(id).subscribe({ next: (s) => { this.sessions.set(s); done(); }, error: fail });
    this.api.devices(id).subscribe({ next: (d) => { this.devices.set(d); done(); }, error: fail });
  }

  /** Session families / device ids with a request in flight: a double click must not fire twice. */
  readonly pending = signal<ReadonlySet<string>>(new Set());

  /** Marks `key` as in flight; false when it already was. Released by `finalize` on the request. */
  private claim(key: string): boolean {
    if (this.pending().has(key)) return false;
    this.pending.update((s) => new Set(s).add(key));
    return true;
  }

  private release(key: string): void {
    this.pending.update((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  }

  revokeSession(session: UserSession): void {
    if (!this.claim(session.family)) return;
    this.api.revokeSession(this.userId(), session.family).pipe(finalize(() => this.release(session.family))).subscribe({
      next: () => {
        this.sessions.update((l) => l.filter((s) => s.family !== session.family));
        this.toast.success('S\'ha fet expirar la sessió.');
      },
      error: () => this.toast.error('No s\'ha pogut fer expirar la sessió.'),
    });
  }

  revokeAll(): void {
    this.busy.set(true);
    this.api.revokeAll(this.userId()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sessions.set([]);
        this.toast.success('S\'han fet expirar totes les sessions.');
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('No s\'han pogut fer expirar les sessions.');
      },
    });
  }

  testDevice(device: UserPushDevice): void {
    this.api.testDevice(this.userId(), device.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('S\'ha enviat la notificació de prova.');
        } else if (res.gone) {
          this.devices.update((l) => l.filter((d) => d.id !== device.id));
          this.toast.info('El dispositiu ja no existeix i s\'ha eliminat.');
        } else {
          this.toast.error('No s\'ha pogut enviar la notificació.');
        }
      },
      error: () => this.toast.error('No s\'ha pogut enviar la notificació.'),
    });
  }

  removeDevice(device: UserPushDevice): void {
    if (!this.claim(device.id)) return;
    this.api.removeDevice(this.userId(), device.id).pipe(finalize(() => this.release(device.id))).subscribe({
      next: () => this.devices.update((l) => l.filter((d) => d.id !== device.id)),
      error: () => this.toast.error('No s\'ha pogut eliminar el dispositiu.'),
    });
  }
}
