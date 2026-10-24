import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Copy, LucideAngularModule, Share2 } from 'lucide-angular';
import { InviteLinkResponse } from '@muixer/shared';
import { AlertComponent, ButtonComponent, InputComponent, ToastService } from '@muixer/ui';
import { PersonService } from '../../services/person.service';
import { formatValenciaDateAndTime } from '../../../../shared/utils';

/**
 * Creates a person's invite link and shows it once, ready to send: copy, share (where the browser
 * can) and its expiry. The token is stored hashed, so the link can't be shown again later; creating
 * another one invalidates this one.
 */
@Component({
  selector: 'app-invite-link-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, AlertComponent, ButtonComponent, InputComponent],
  templateUrl: './invite-link-panel.component.html',
})
export class InviteLinkPanelComponent implements OnInit {
  private readonly personService = inject(PersonService);
  private readonly toast = inject(ToastService);

  protected readonly CopyIcon = Copy;
  protected readonly ShareIcon = Share2;

  personId = input.required<string>();
  alias = input.required<string>();
  /** Create the link on arrival (the caller's own button already asked for it). */
  autoGenerate = input(false);
  /** Show the panel's own «Crea l'enllaç d'invitació»; off when a parent's footer holds it. */
  withButton = input(true);

  generated = output<InviteLinkResponse>();

  /** Read by a parent that owns the button (its loading state, which footer to show). */
  readonly link = signal<InviteLinkResponse | null>(null);
  readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expiry = computed(() => {
    const link = this.link();
    return link ? formatValenciaDateAndTime(link.expiresAt) : null;
  });
  protected readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  ngOnInit(): void {
    if (this.autoGenerate()) this.generate();
  }

  generate(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.error.set(null);
    this.personService.createInviteLink(this.personId()).subscribe({
      next: (link) => {
        this.generating.set(false);
        this.link.set(link);
        this.generated.emit(link);
      },
      error: (err) => {
        this.generating.set(false);
        this.error.set(err?.error?.message ?? "No s'ha pogut crear l'enllaç d'invitació.");
      },
    });
  }

  async copy(): Promise<void> {
    const link = this.link();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.inviteUrl);
      this.toast.success("S'ha copiat l'enllaç.");
    } catch {
      this.toast.error("No s'ha pogut copiar l'enllaç. Seleccioneu-lo i copieu-lo a mà.");
    }
  }

  async share(): Promise<void> {
    const link = this.link();
    if (!link) return;
    try {
      await navigator.share({ title: 'Invitació a MuixerApp', url: link.inviteUrl });
    } catch {
      // Closing the share sheet rejects too: nothing to report.
    }
  }
}
