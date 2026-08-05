import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { LegalDocumentType } from '@muixer/shared';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LegalDocumentService } from '../../../core/services/legal-document.service';
import { ToastService } from '../feedback/toast/toast.service';

/**
 * Blocking click-wrap consent gate. Rendered by the app shell whenever the authenticated user
 * must (re)accept the privacy policy. Deliberately non-dismissible: no backdrop-click, no Escape,
 * no Cancel — the only exit is accepting.
 */
@Component({
  selector: 'app-privacy-consent-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog class="modal modal-open" aria-modal="true" role="dialog" aria-labelledby="privacy-consent-title">
      <div class="modal-box max-w-2xl">
        <h3 id="privacy-consent-title" class="font-bold text-lg mb-2">
          {{ hadAcceptedBefore() ? "La Política de Privacitat s'ha actualitzat" : 'Política de Privacitat' }}
        </h3>
        <p class="text-sm text-base-content/60 mb-4">
          {{ hadAcceptedBefore()
            ? "Cal que la tornis a llegir i acceptar per continuar utilitzant l'aplicació."
            : "Per continuar utilitzant l'aplicació cal que llegeixis i acceptis la política de privacitat." }}
        </p>

        @if (loading()) {
          <div class="flex justify-center py-8"><span class="loading loading-spinner"></span></div>
        } @else if (content()) {
          <div class="max-h-[50vh] overflow-y-auto rounded-box bg-base-200 p-4 text-sm whitespace-pre-wrap mb-4">{{ content() }}</div>
        } @else {
          <div class="alert alert-error mb-4"><span>No s'ha pogut carregar la política de privacitat.</span></div>
        }

        <div class="modal-action">
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="loading() || !content() || submitting()"
            (click)="accept()"
          >
            @if (submitting()) { <span class="loading loading-spinner loading-xs"></span> }
            Accepto
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class PrivacyConsentModalComponent {
  private readonly auth = inject(AuthService);
  private readonly legalService = inject(LegalDocumentService);
  private readonly toast = inject(ToastService);

  protected readonly content = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  /** True if this account had already accepted a (now superseded) version — i.e. this is a re-consent, not a first acceptance. */
  protected readonly hadAcceptedBefore = computed(
    () => this.auth.currentUser()?.privacyPolicyAcceptedAt != null,
  );

  constructor() {
    this.legalService.getActive(LegalDocumentType.PRIVACY_POLICY).subscribe({
      next: (doc) => {
        this.content.set(doc.content);
        this.loading.set(false);
      },
      error: () => {
        this.content.set(null);
        this.loading.set(false);
      },
    });
  }

  accept(): void {
    this.submitting.set(true);
    this.auth.acceptPrivacyConsent().subscribe({
      next: () => this.submitting.set(false),
      error: () => {
        this.submitting.set(false);
        this.toast.error("No s'ha pogut registrar l'acceptació. Torna-ho a provar.");
      },
    });
  }
}
