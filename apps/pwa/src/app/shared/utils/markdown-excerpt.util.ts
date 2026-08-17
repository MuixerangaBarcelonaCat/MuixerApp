import { marked } from 'marked';

/** Renders markdown to plain text and truncates it to `maxChars`, appending an ellipsis when cut. */
export function markdownExcerpt(body: string, maxChars: number): string {
  const html = marked.parse(body, { async: false }) as string;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}
