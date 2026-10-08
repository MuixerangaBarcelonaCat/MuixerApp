import { Injectable, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Marked } from 'marked';

/**
 * Renders stored Markdown to HTML for display. Sanitization is part of the service rather than
 * the caller's job: every consumer renders content an admin typed, so skipping it anywhere would
 * be an XSS hole, and the two places that did this by hand had already drifted into copies.
 *
 * Uses a private `Marked` instance instead of the global `marked` singleton — the global one is
 * process-wide, so configuring it here would silently change anyone else's rendering.
 */
@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly sanitizer = inject(DomSanitizer);

  private readonly marked = new Marked({ async: false }).use({
    renderer: {
      // Links must open in a new tab: in the dashboard the editor may hold unsaved changes, and
      // in the installed PWA a plain <a href> would navigate the whole app shell away.
      // `this.parser` is wired up by marked at call time, so this has to stay a regular
      // function rather than an arrow function bound early.
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const titleAttr = title ? ` title="${title}"` : '';
        return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer" class="underline">${text}</a>`;
      },
    },
  });

  render(markdown: string | null | undefined): string {
    if (!markdown) return '';
    const html = this.marked.parse(markdown) as string;
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }
}
