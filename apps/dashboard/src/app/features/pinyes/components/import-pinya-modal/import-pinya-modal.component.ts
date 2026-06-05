import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SlicePipe } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { LucideAngularModule, Import, X } from 'lucide-angular';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { BulkImportResult, FigureHistoryEntry } from '../../models/assignment.model';

@Component({
  selector: 'app-import-pinya-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, SlicePipe, CdkTrapFocus],
  templateUrl: './import-pinya-modal.component.html',
})
export class ImportPinyaModalComponent {
  readonly figureTemplateId = input.required<string>();
  readonly currentInstanceId = input.required<string>();
  readonly open = input<boolean>(false);

  readonly importCompleted = output<BulkImportResult>();
  readonly closed = output<void>();

  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly Import = Import;
  readonly X = X;

  readonly history = signal<FigureHistoryEntry[]>([]);
  readonly loading = signal(false);
  readonly importing = signal(false);
  readonly selectedEntry = signal<FigureHistoryEntry | null>(null);
  readonly lastResult = signal<BulkImportResult | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.selectedEntry.set(null);
        this.lastResult.set(null);
        this.error.set(null);
        this.loadHistory();
      }
    });
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.assignmentService.getHistory(this.figureTemplateId()).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (resp) => {
        const filtered = resp.data.filter((e) => e.instanceId !== this.currentInstanceId());
        this.history.set(filtered);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectEntry(entry: FigureHistoryEntry): void {
    if (!entry.snapshotted) return;
    this.selectedEntry.set(entry);
    this.lastResult.set(null);
  }

  doImport(): void {
    const entry = this.selectedEntry();
    if (!entry) return;

    this.importing.set(true);
    this.error.set(null);

    this.assignmentService
      .bulkImport(this.currentInstanceId(), { sourceInstanceId: entry.instanceId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.importing.set(false);
          this.lastResult.set(result);
          this.importCompleted.emit(result);
        },
        error: () => {
          this.importing.set(false);
          this.error.set('Error en importar les assignacions. Torna-ho a intentar.');
        },
      });
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
