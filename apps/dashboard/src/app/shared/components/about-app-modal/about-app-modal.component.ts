import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { COPYRIGHT_HOLDER, LegalDocumentType, SOURCE_CODE_URL, formatCopyrightYears } from '@muixer/shared';
import { AlertComponent, ModalComponent } from '@muixer/ui';
import { MarkdownViewComponent } from '@muixer/ui/markdown';
import { LegalDocumentService } from '../../../core/services/legal-document.service';

/**
 * «Sobre l'app»: contact, privacy policy, source code link and copyright — the same
 * content as the PWA's Configuració → Sobre l'app. Opened from the user menu.
 */
@Component({
  selector: 'app-about-app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, AlertComponent, MarkdownViewComponent],
  template: `
    <lib-modal [open]="open()" title="Sobre l'app" size="2xl" (closed)="closed.emit()">
      <div class="flex flex-col gap-5">
        <section data-testid="about-contact">
          <h3 class="text-sm font-semibold mb-1">Contacte</h3>
          <p class="text-sm text-base-content/70">
            Encara no hi ha cap adreça de correu. Parleu amb la Comissió Tecnològica.
          </p>
        </section>

        <section data-testid="privacy-policy-viewer">
          <h3 class="text-sm font-semibold mb-1">Política de privacitat</h3>
          @if (policyLoading()) {
            <div class="flex justify-center py-4">
              <span class="loading loading-spinner loading-sm"></span>
            </div>
          } @else if (policyContent(); as content) {
            <!-- Deferred so marked stays out of the initial bundle. -->
            @defer (on immediate) {
              <div class="max-h-80 overflow-y-auto rounded-box bg-base-200 p-3">
                <lib-markdown-view [content]="content" />
              </div>
            }
          } @else {
            <lib-alert variant="error" dense>No s'ha pogut carregar la política de privacitat.</lib-alert>
          }
        </section>

        <section class="flex flex-col gap-1 text-sm text-base-content/70" data-testid="about-info">
          <p>
            El codi d'esta aplicació està disponible a
            <a [href]="sourceCodeUrl" target="_blank" rel="noopener noreferrer" class="link link-primary">GitHub</a>.
          </p>
          <p class="text-base-content/50">© {{ copyrightYears }} {{ copyrightHolder }}</p>
        </section>
      </div>
    </lib-modal>
  `,
})
export class AboutAppModalComponent {
  private readonly legalService = inject(LegalDocumentService);

  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly copyrightYears = formatCopyrightYears(new Date().getFullYear());
  protected readonly copyrightHolder = COPYRIGHT_HOLDER;
  protected readonly sourceCodeUrl = SOURCE_CODE_URL;

  protected readonly policyContent = signal<string | null>(null);
  protected readonly policyLoading = signal(false);
  private policyRequested = false;

  constructor() {
    // Lazy: the policy is only fetched the first time the modal opens.
    effect(() => {
      if (!this.open() || this.policyRequested) return;
      this.policyRequested = true;
      untracked(() => this.loadPolicy());
    });
  }

  private loadPolicy(): void {
    this.policyLoading.set(true);
    this.legalService.getActive(LegalDocumentType.PRIVACY_POLICY).subscribe({
      next: (doc) => {
        this.policyContent.set(doc.content);
        this.policyLoading.set(false);
      },
      error: () => this.policyLoading.set(false),
    });
  }
}
