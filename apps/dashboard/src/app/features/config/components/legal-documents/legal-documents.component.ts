import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { LegalDocument, LegalDocumentType } from '@muixer/shared';
import { LegalDocumentService } from '../../../../core/services/legal-document.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';

interface EditableType {
  type: LegalDocumentType;
  label: string;
  description: string;
}

@Component({
  selector: 'app-legal-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 class="text-xl font-bold text-base-content">Privacitat i legal</h1>
        <p class="text-xs text-base-content/50 mt-0.5">
          Textos legals versionats. Publicar una versió nova de la Política de Privacitat torna a
          demanar el consentiment a tots els usuaris.
        </p>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-8"><span class="loading loading-spinner"></span></div>
      } @else {
        @for (t of types; track t.type) {
          <div class="card bg-base-100 shadow-sm border-l-4 border-warning">
            <div class="card-body p-4 space-y-3">
              <div class="flex items-center justify-between">
                <h2 class="font-semibold">{{ t.label }}</h2>
                <span class="badge badge-ghost badge-sm">
                  {{ activeVersion(t.type) !== null ? 'Versió activa: v' + activeVersion(t.type) : 'Sense versió activa' }}
                </span>
              </div>
              <p class="text-xs text-base-content/50">{{ t.description }}</p>
              <textarea
                class="textarea textarea-bordered w-full font-mono text-xs h-64"
                [value]="draft(t.type)"
                (input)="onInput(t.type, $event)"
                [attr.aria-label]="t.label"
              ></textarea>
              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="saving() === t.type || draft(t.type).trim().length === 0"
                  (click)="publish(t.type)"
                >
                  @if (saving() === t.type) { <span class="loading loading-spinner loading-xs"></span> }
                  Publica nova versió
                </button>
              </div>
            </div>
          </div>
        }
      }
    </div>
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
        'Es mostra al modal de consentiment obligatori. Publicar-ne una versió nova torna a demanar el consentiment a tothom.',
    },
    {
      type: LegalDocumentType.TRANSPARENCY_CLAUSE,
      label: 'Clàusula de transparència',
      description: "Es mostra al formulari d'alta i edició de membres.",
    },
  ];

  protected readonly loading = signal(true);
  protected readonly saving = signal<LegalDocumentType | null>(null);
  private readonly documents = signal<LegalDocument[]>([]);
  private readonly drafts = signal<Record<string, string>>({});

  constructor() {
    this.load();
  }

  protected activeVersion(type: LegalDocumentType): number | null {
    return this.documents().find((d) => d.type === type && d.isActive)?.version ?? null;
  }

  protected draft(type: LegalDocumentType): string {
    return this.drafts()[type] ?? '';
  }

  protected onInput(type: LegalDocumentType, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.drafts.update((d) => ({ ...d, [type]: value }));
  }

  protected publish(type: LegalDocumentType): void {
    this.saving.set(type);
    this.legalService.publish({ type, content: this.draft(type) }).subscribe({
      next: () => {
        this.saving.set(null);
        this.toast.success('Nova versió publicada.');
        this.load();
      },
      error: () => {
        this.saving.set(null);
        this.toast.error("No s'ha pogut publicar la nova versió.");
      },
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
