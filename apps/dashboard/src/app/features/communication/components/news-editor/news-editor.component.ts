import { Component, ChangeDetectionStrategy, inject, signal, computed, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { marked } from 'marked';
import { NewsStatus } from '@muixer/shared';
import { NewsService } from '../../services/news.service';
import { ToastService, BadgeComponent, ButtonComponent, CardComponent, InputComponent } from '@muixer/ui';
import { getNewsStatus, getNewsStatusLabel, toDatetimeLocalValue, fromDatetimeLocalValue } from '../../../../shared/utils';

marked.setOptions({ async: false });

// Preview links must open in a new tab — the editor has unsaved changes, so a plain <a href>
// would navigate the whole admin tab away from them on click. `this.parser` is wired up by marked
// at call time, so this must stay a regular function (not an arrow function bound early).
const renderer = new marked.Renderer();
renderer.link = function ({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  const titleAttr = title ? ` title="${title}"` : '';
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer" class="underline">${text}</a>`;
};
marked.use({ renderer });

@Component({
  selector: 'app-news-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, BadgeComponent, ButtonComponent, CardComponent, InputComponent],
  templateUrl: './news-editor.component.html',
})
export class NewsEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly newsService = inject(NewsService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly newsId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  readonly isEditMode = computed(() => this.newsId() !== null);

  readonly title = signal('');
  readonly body = signal('');
  readonly publishedAtLocal = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly canSave = computed(() => this.title().trim().length > 0 && this.body().trim().length > 0 && !this.saving());

  /** In this editor, PUBLISHED means "will publish as soon as it's saved" — call it Immediata, not Publicada. */
  readonly statusLabel = computed(() => {
    const status = getNewsStatus({ publishedAt: fromDatetimeLocalValue(this.publishedAtLocal()) });
    return status === NewsStatus.PUBLISHED ? 'Immediata' : getNewsStatusLabel(status);
  });

  readonly previewHtml = computed(
    () => this.sanitizer.sanitize(SecurityContext.HTML, marked.parse(this.body()) as string) ?? '',
  );

  constructor() {
    const id = this.newsId();
    if (id) {
      this.loading.set(true);
      this.newsService.getOne(id).subscribe({
        next: (news) => {
          this.title.set(news.title);
          this.body.set(news.body);
          this.publishedAtLocal.set(toDatetimeLocalValue(news.publishedAt));
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
      publishedAt: fromDatetimeLocalValue(this.publishedAtLocal()),
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

  cancel(): void {
    this.router.navigate(['/communication/news']);
  }

  setPublishNow(): void {
    this.publishedAtLocal.set(toDatetimeLocalValue(new Date().toISOString()));
  }
}
