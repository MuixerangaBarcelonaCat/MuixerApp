import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { NewsService } from '../../services/news.service';
import { ToastService, ButtonComponent, ButtonGroupComponent, CardComponent, InputComponent, CheckboxComponent } from '@muixer/ui';
import { MarkdownEditorComponent } from '@muixer/ui/markdown-editor';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../../../shared/utils';

/**
 * How the news gets its `publishedAt`. Replaces the previous implicit workflow, where a blank
 * datetime meant "draft" and an «Ara» button stamped the current instant into the same field —
 * the state was only legible by reading the field's contents.
 */
export type PublishMode = 'draft' | 'now' | 'scheduled';

@Component({
  selector: 'app-news-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, ButtonComponent, ButtonGroupComponent, CardComponent, InputComponent, CheckboxComponent, MarkdownEditorComponent, DatePipe],
  templateUrl: './news-editor.component.html',
})
export class NewsEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly newsService = inject(NewsService);
  private readonly toast = inject(ToastService);

  private readonly newsId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  readonly isEditMode = computed(() => this.newsId() !== null);

  readonly title = signal('');
  readonly body = signal('');
  readonly publishMode = signal<PublishMode>('draft');
  readonly publishedAtLocal = signal('');
  readonly sendPush = signal(true);
  /** Once a push has been sent for this news, the toggle should be disabled. */
  readonly pushSentAt = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly canSave = computed(
    () =>
      this.title().trim().length > 0 &&
      this.body().trim().length > 0 &&
      // A scheduled news without a date has nothing to schedule.
      (this.publishMode() !== 'scheduled' || this.publishedAtLocal().length > 0) &&
      !this.saving(),
  );

  /** True once the scheduled date has passed — an already-published news being edited. */
  readonly scheduledInThePast = computed(() => {
    const iso = fromDatetimeLocalValue(this.publishedAtLocal());
    return iso !== null && new Date(iso) <= new Date();
  });

  constructor() {
    const id = this.newsId();
    if (id) {
      this.loading.set(true);
      this.newsService.getOne(id).subscribe({
        next: (news) => {
          this.title.set(news.title);
          this.body.set(news.body);
          this.publishedAtLocal.set(toDatetimeLocalValue(news.publishedAt));
          // A stored date stays on «Programa» with that exact value, so editing an
          // already-published news does not move its publication timestamp.
          this.publishMode.set(news.publishedAt ? 'scheduled' : 'draft');
          this.sendPush.set(news.sendPush ?? false);
          this.pushSentAt.set(news.pushSentAt ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Error en carregar la notícia.');
        },
      });
    }
  }

  save(): void {
    if (!this.canSave()) return;

    const payload = {
      title: this.title().trim(),
      body: this.body(),
      publishedAt: this.resolvePublishedAt(),
      sendPush: this.sendPush(),
    };

    this.saving.set(true);
    const id = this.newsId();
    const request = id ? this.newsService.update(id, payload) : this.newsService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(id ? 'Notícia actualitzada.' : 'Notícia creada.');
        this.router.navigate(['/communication/news']);
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.message ?? 'Error en desar la notícia.';
        this.toast.error(msg);
      },
    });
  }

  private resolvePublishedAt(): string | null {
    switch (this.publishMode()) {
      case 'draft':
        return null;
      case 'now':
        return new Date().toISOString();
      case 'scheduled':
        return fromDatetimeLocalValue(this.publishedAtLocal());
    }
  }

  cancel(): void {
    this.router.navigate(['/communication/news']);
  }

}
