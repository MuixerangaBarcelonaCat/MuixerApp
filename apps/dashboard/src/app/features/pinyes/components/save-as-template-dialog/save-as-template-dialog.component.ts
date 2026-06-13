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
import { LucideAngularModule, Save, AlertTriangle } from 'lucide-angular';
import { FigureZone } from '@muixer/shared';
import { InstanceNodeItem } from '../../models/assignment.model';
import { FigureTemplateService } from '../../services/figure-template.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';

export interface SaveAsTemplateResult {
  mode: 'overwrite' | 'new_version';
  templateId: string;
}

@Component({
  selector: 'app-save-as-template-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  template: `
    @if (open()) {
      <dialog class="modal modal-open" aria-labelledby="save-template-title" role="dialog">
        <div class="modal-box max-w-lg">
          <h3 id="save-template-title" class="font-bold text-lg mb-4">Desar com a template</h3>

          <p class="text-sm text-base-content/70 mb-4">
            Es desaran {{ saveableNodeCount() }} nodes
            @if (adHocNodeCount() > 0) {
              ({{ adHocNodeCount() }} creats manualment)
            }. No s'inclouran nodes decoratius ni de direcció.
          </p>

          @if (saveableNodeCount() === 0) {
            <div class="alert alert-warning mb-4" role="alert">
              <i-lucide [img]="AlertTriangle" class="size-5" aria-hidden="true" />
              <span>No hi ha nodes per desar. Tots els nodes de la instància són decoratius o de direcció.</span>
            </div>
          }

          <!-- Mode selection -->
          <fieldset class="mb-4">
            <legend class="sr-only">Mode de desat</legend>
            <label class="flex items-center gap-3 cursor-pointer mb-2">
              <input
                type="radio"
                name="save-mode"
                class="radio radio-primary radio-sm"
                [checked]="mode() === 'overwrite'"
                (change)="mode.set('overwrite')"
              />
              <span class="text-sm">Sobreescriure el template «{{ templateName() }}»</span>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="save-mode"
                class="radio radio-primary radio-sm"
                [checked]="mode() === 'new_version'"
                (change)="mode.set('new_version')"
              />
              <span class="text-sm">Crear una nova versió</span>
            </label>
          </fieldset>

          @if (mode() === 'new_version') {
            <div class="form-control mb-4">
              <label class="label" for="version-name">
                <span class="label-text">Nom de la nova versió</span>
              </label>
              <input
                id="version-name"
                type="text"
                class="input input-bordered input-sm w-full"
                [ngModel]="versionName()"
                (ngModelChange)="versionName.set($event)"
                maxlength="200"
                placeholder="Ex: Pilar de 4 v2"
              />
            </div>
          }

          @if (mode() === 'overwrite') {
            <div class="alert alert-info text-xs mb-4" role="note">
              <i-lucide [img]="AlertTriangle" class="size-4 shrink-0" aria-hidden="true" />
              <span>
                Les instàncies existents no es veuran afectades,
                però les noves instàncies usaran la disposició actualitzada.
              </span>
            </div>
          }

          <div class="modal-action">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="closed.emit()"
              [disabled]="saving()"
            >
              Cancel·lar
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm gap-1"
              (click)="onSave()"
              [disabled]="saving() || saveableNodeCount() === 0 || (mode() === 'new_version' && !versionName().trim())"
            >
              @if (saving()) {
                <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
              } @else {
                <i-lucide [img]="Save" class="size-4" aria-hidden="true" />
              }
              Desar
            </button>
          </div>
        </div>
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div class="modal-backdrop" (click)="!saving() && closed.emit()"></div>
      </dialog>
    }
  `,
})
export class SaveAsTemplateDialogComponent implements OnChanges {
  private readonly templateService = inject(FigureTemplateService);
  private readonly toast = inject(ToastService);

  readonly Save = Save;
  readonly AlertTriangle = AlertTriangle;

  readonly open = input.required<boolean>();
  readonly instanceId = input.required<string>();
  readonly templateId = input.required<string>();
  readonly templateName = input.required<string>();
  readonly instanceNodes = input.required<InstanceNodeItem[]>();

  readonly closed = output<void>();
  readonly saved = output<SaveAsTemplateResult>();

  readonly mode = signal<'overwrite' | 'new_version'>('new_version');
  readonly versionName = signal('');
  readonly saving = signal(false);
  private suggestedNameLoaded = false;

  private static readonly SAVEABLE_ZONES = new Set([
    FigureZone.PINYA,
    FigureZone.BASE,
    FigureZone.TRONC,
  ]);

  readonly saveableNodes = computed(() =>
    this.instanceNodes().filter((n) =>
      SaveAsTemplateDialogComponent.SAVEABLE_ZONES.has(n.zone as FigureZone),
    ),
  );

  readonly saveableNodeCount = computed(() => this.saveableNodes().length);

  readonly adHocNodeCount = computed(() =>
    this.saveableNodes().filter((n) => n.isAdHoc).length,
  );

  ngOnChanges(): void {
    if (this.open() && !this.suggestedNameLoaded) {
      this.suggestedNameLoaded = true;
      this.templateService.suggestVersionName(this.templateId()).subscribe({
        next: (resp) => {
          if (!this.versionName().trim()) {
            this.versionName.set(resp.suggestedName);
          }
        },
      });
    }
    if (!this.open()) {
      this.suggestedNameLoaded = false;
      this.mode.set('new_version');
      this.versionName.set('');
      this.saving.set(false);
    }
  }

  onSave(): void {
    this.saving.set(true);
    const payload = {
      instanceId: this.instanceId(),
      mode: this.mode(),
      name: this.mode() === 'new_version' ? this.versionName().trim() : undefined,
    };

    this.templateService.saveFromInstance(this.templateId(), payload).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.toast.success(
          this.mode() === 'overwrite'
            ? `Template «${this.templateName()}» actualitzat correctament.`
            : `Nova versió «${payload.name}» creada correctament.`,
        );
        this.saved.emit({ mode: this.mode(), templateId: result.id });
        this.closed.emit();
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.message ?? 'Error en desar el template.';
        this.toast.error(msg);
      },
    });
  }
}
