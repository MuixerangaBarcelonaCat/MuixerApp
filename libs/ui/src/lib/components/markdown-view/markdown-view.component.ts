import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MarkdownService } from '../../services/markdown.service';

/**
 * Stored Markdown shown as typeset text — sanitized by `MarkdownService`. Plain text with no
 * Markdown still reads fine: blank lines become paragraphs.
 */
@Component({
  selector: 'lib-markdown-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="prose prose-sm max-w-none" [innerHTML]="html()"></div>`,
})
export class MarkdownViewComponent {
  private readonly markdown = inject(MarkdownService);

  readonly content = input<string | null | undefined>(null);

  protected readonly html = computed(() => this.markdown.render(this.content()));
}
