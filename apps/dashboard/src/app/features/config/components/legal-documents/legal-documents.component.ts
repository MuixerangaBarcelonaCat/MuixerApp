import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { LegalDocument, LegalDocumentType } from '@muixer/shared';
import {
  LegalDocumentService,
  PublishLegalDocumentDto,
} from '../../../../core/services/legal-document.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';

interface EditableType {
  type: LegalDocumentType;
  label: string;
  description: string;
  /** Whether publishing this type can ever require re-consent (false for TRANSPARENCY_CLAUSE, which is purely informative). */
  gatesConsent: boolean;
}

interface PendingPublish {
  type: LegalDocumentType;
  label: string;
  requiresConsent: boolean;
}

/** A version formats a `LegalDocument` for display: whether it's the active text and/or the consent watermark. */
type VersionRow = LegalDocument;

@Component({
  selector: 'app-legal-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 class="text-xl font-bold text-base-content">Privacitat i legal</h1>
        <p class="text-xs text-base-content/50 mt-0.5">
          Textos legals versionats. Una <strong>correcció</strong> actualitza el text sense demanar
          de nou el consentiment; una <strong>versió nova</strong> obliga tots els usuaris a
          tornar a acceptar la política.
        </p>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-8"><span class="loading loading-spinner"></span></div>
      } @else {
        @for (t of types; track t.type) {
          <div class="card bg-base-100 shadow-sm border-l-4 border-warning">
            <div class="card-body p-4 space-y-3">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <h2 class="font-semibold">{{ t.label }}</h2>
                <div class="flex items-center gap-2">
                  <span class="badge badge-ghost badge-sm">
                    {{ activeVersion(t.type) !== null ? 'Versió activa: v' + activeVersion(t.type) : 'Sense versió activa' }}
                  </span>
                  @if (t.gatesConsent) {
                    <span class="badge badge-warning badge-sm badge-outline">
                      {{ consentVersion(t.type) !== null ? 'Consentiment vigent: v' + consentVersion(t.type) : 'Sense consentiment demanat' }}
                    </span>
                  }
                </div>
              </div>
              <p class="text-xs text-base-content/50">{{ t.description }}</p>
              <textarea
                class="textarea textarea-bordered w-full font-mono text-xs h-64"
                [value]="draft(t.type)"
                (input)="onInput(t.type, $event)"
                [attr.aria-label]="t.label"
              ></textarea>

              <div class="flex justify-end gap-2 flex-wrap">
                @if (t.gatesConsent) {
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    [disabled]="saving() === t.type || draft(t.type).trim().length === 0"
                    (click)="requestPublish(t, false)"
                  >
                    Desa correcció
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    [disabled]="saving() === t.type || draft(t.type).trim().length === 0"
                    (click)="requestPublish(t, true)"
                  >
                    @if (saving() === t.type) { <span class="loading loading-spinner loading-xs"></span> }
                    Publica versió nova (cal reacceptar)
                  </button>
                } @else {
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    [disabled]="saving() === t.type || draft(t.type).trim().length === 0"
                    (click)="requestPublish(t, false)"
                  >
                    @if (saving() === t.type) { <span class="loading loading-spinner loading-xs"></span> }
                    Publica
                  </button>
                }
              </div>

              <!-- Historial de versions -->
              <div class="border-t border-base-300 pt-2">
                <button
                  type="button"
                  class="text-xs text-base-content/50 hover:text-base-content underline"
                  (click)="toggleHistory(t.type)"
                >
                  {{ historyOpenFor() === t.type ? 'Amaga historial' : 'Veure historial de versions' }}
                </button>

                @if (historyOpenFor() === t.type) {
                  <ul class="mt-2 space-y-1">
                    @for (v of versionsFor(t.type); track v.id) {
                      <li class="flex items-center justify-between text-xs gap-2 py-1">
                        <div class="flex items-center gap-2">
                          <span class="font-mono">v{{ v.version }}</span>
                          @if (v.isActive) {
                            <span class="badge badge-success badge-xs">Activa</span>
                          }
                          @if (t.gatesConsent) {
                            @if (v.requiresConsent) {
                              <span class="badge badge-warning badge-xs">Requeria acceptació</span>
                            } @else {
                              <span class="badge badge-ghost badge-xs">Correcció</span>
                            }
                          }
                          <span class="text-base-content/50">{{ formatDate(v.publishedAt) }}</span>
                        </div>
                        <button type="button" class="btn btn-ghost btn-xs" (click)="viewVersion(v)">
                          Veure
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
          </div>
        }
      }
    </div>

    <!-- Modal de confirmació abans de publicar -->
    @if (pendingPublish(); as pending) {
      <dialog class="modal modal-open" aria-labelledby="publish-confirm-title" role="dialog">
        <div class="modal-box max-w-md">
          <h3 id="publish-confirm-title" class="font-bold text-lg mb-2">
            {{ pending.requiresConsent ? 'Publicar versió nova?' : 'Desar correcció?' }}
          </h3>

          @if (pending.requiresConsent) {
            <div class="alert alert-warning text-sm mb-4">
              <span>
                <strong>Tots els usuaris</strong> hauran de tornar a acceptar la
                {{ pending.label }} la propera vegada que entrin a l'aplicació.
              </span>
            </div>
          } @else {
            <p class="text-sm text-base-content/70 mb-4">
              Es publica com a correcció del text de {{ pending.label }}: ningú tornarà a haver
              d'acceptar-la de nou.
            </p>
          }

          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancelPublish()">
              Cancel·la
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [class.btn-warning]="pending.requiresConsent"
              (click)="confirmPublish()"
            >
              Confirma
            </button>
          </div>
        </div>
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div class="modal-backdrop" (click)="cancelPublish()"></div>
      </dialog>
    }

    <!-- Modal de lectura d'una versió de l'historial -->
    @if (viewingVersion(); as v) {
      <dialog class="modal modal-open" aria-labelledby="version-view-title" role="dialog">
        <div class="modal-box max-w-2xl">
          <h3 id="version-view-title" class="font-bold text-lg mb-2">
            v{{ v.version }} — {{ formatDate(v.publishedAt) }}
          </h3>
          <div class="max-h-[50vh] overflow-y-auto rounded-box bg-base-200 p-4 text-sm whitespace-pre-wrap mb-4">{{ v.content }}</div>
          <div class="modal-action">
            <button type="button" class="btn btn-sm" (click)="viewingVersion.set(null)">Tanca</button>
          </div>
        </div>
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div class="modal-backdrop" (click)="viewingVersion.set(null)"></div>
      </dialog>
    }
  `,
})
export class LegalDocumentsComponent {
  private readonly legalService = inject(LegalDocumentService);
  private readonly toast = inject(ToastService);

  protected readonly types: EditableType[] = [
    {
      type: LegalDocumentType.PRIVACY_POLICY,
      label: 'Política de Privacitat',
      description:
        'Es mostra al modal de consentiment obligatori. Una versió nova torna a demanar el ' +
        'consentiment a tothom; una correcció no.',
      gatesConsent: true,
    },
    {
      type: LegalDocumentType.TRANSPARENCY_CLAUSE,
      label: 'Clàusula de transparència',
      description:
        "Es mostra al formulari d'alta i edició de membres. És informativa: mai obliga a acceptar res.",
      gatesConsent: false,
    },
  ];

  protected readonly loading = signal(true);
  protected readonly saving = signal<LegalDocumentType | null>(null);
  protected readonly pendingPublish = signal<PendingPublish | null>(null);
  protected readonly viewingVersion = signal<VersionRow | null>(null);
  protected readonly historyOpenFor = signal<LegalDocumentType | null>(null);
  private readonly documents = signal<LegalDocument[]>([]);
  private readonly drafts = signal<Record<string, string>>({});

  constructor() {
    this.load();
  }

  protected activeVersion(type: LegalDocumentType): number | null {
    return this.documents().find((d) => d.type === type && d.isActive)?.version ?? null;
  }

  /** The consent watermark: the highest version of this type that ever required re-acceptance. */
  protected consentVersion(type: LegalDocumentType): number | null {
    const consentDocs = this.documents().filter((d) => d.type === type && d.requiresConsent);
    if (consentDocs.length === 0) return null;
    return Math.max(...consentDocs.map((d) => d.version));
  }

  protected versionsFor(type: LegalDocumentType): VersionRow[] {
    return this.documents()
      .filter((d) => d.type === type)
      .sort((a, b) => b.version - a.version);
  }

  protected draft(type: LegalDocumentType): string {
    return this.drafts()[type] ?? '';
  }

  protected onInput(type: LegalDocumentType, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.drafts.update((d) => ({ ...d, [type]: value }));
  }

  protected toggleHistory(type: LegalDocumentType): void {
    this.historyOpenFor.update((current) => (current === type ? null : type));
  }

  protected viewVersion(version: VersionRow): void {
    this.viewingVersion.set(version);
  }

  protected requestPublish(t: EditableType, requiresConsent: boolean): void {
    this.pendingPublish.set({ type: t.type, label: t.label, requiresConsent });
  }

  protected cancelPublish(): void {
    this.pendingPublish.set(null);
  }

  protected confirmPublish(): void {
    const pending = this.pendingPublish();
    if (!pending) return;
    this.pendingPublish.set(null);

    const dto: PublishLegalDocumentDto = {
      type: pending.type,
      content: this.draft(pending.type),
      requiresConsent: pending.requiresConsent,
    };

    this.saving.set(pending.type);
    this.legalService.publish(dto).subscribe({
      next: () => {
        this.saving.set(null);
        this.toast.success(
          pending.requiresConsent
            ? 'Versió nova publicada. Es demanarà el consentiment a tothom.'
            : 'Correcció desada.',
        );
        this.load();
      },
      error: () => {
        this.saving.set(null);
        this.toast.error("No s'ha pogut publicar.");
      },
    });
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('ca-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private load(): void {
    this.loading.set(true);
    this.legalService.getAll().subscribe({
      next: (docs) => {
        this.documents.set(docs);
        const drafts: Record<string, string> = {};
        for (const t of this.types) {
          drafts[t.type] = docs.find((d) => d.type === t.type && d.isActive)?.content ?? '';
        }
        this.drafts.set(drafts);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No s\'han pogut carregar els documents legals.');
      },
    });
  }
}
