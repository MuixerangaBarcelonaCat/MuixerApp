import { Injectable, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Marked, Renderer } from 'marked';

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
      // Marked has no option for extra link attributes, so this wraps its default renderer
      // rather than rebuilding the tag: the default is what escapes `href` and `title`. Ours go
      // first because the browser keeps the first of two repeated attributes. A URL marked
      // refuses comes back as plain text, which the replace leaves alone.
      // `this` is the renderer marked wires up at call time, so this has to stay a regular
      // function rather than an arrow function bound early.
      link(token) {
        return Renderer.prototype.link
          .call(this, token)
          .replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" class="underline" ');
      },
    },
  });

  render(markdown: string | null | undefined): string {
    if (!markdown) return '';
    const html = this.marked.parse(markdown) as string;
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }
}
