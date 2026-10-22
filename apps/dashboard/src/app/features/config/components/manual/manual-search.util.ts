export interface ManualSource {
  slug: string;
  title: string;
  markdown: string;
}

export interface ManualHit {
  slug: string;
  title: string;
  snippet: string;
}

interface IndexedPage {
  slug: string;
  title: string;
  /** Markdown syntax removed, original accents and case kept (shown in snippets). */
  text: string;
  /** Same as `text` after `normalizeText`; equal length so match offsets carry over. */
  folded: string;
  foldedTitle: string;
}

const MIN_QUERY_LENGTH = 2;
const SNIPPET_RADIUS = 130;

/** Lower-case and strip accents so «assistencia» finds «Assistència». Length-preserving for BMP text. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*#_`>«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildManualIndex(pages: readonly ManualSource[]): IndexedPage[] {
  return pages.map(({ slug, title, markdown }) => {
    const text = stripMarkdown(markdown);
    // Fold per character so offsets in `folded` match offsets in `text`.
    const folded = Array.from(text, (c) => normalizeText(c)).join('');
    return { slug, title, text, folded, foldedTitle: normalizeText(title) };
  });
}

export function searchManual(index: readonly IndexedPage[], query: string): ManualHit[] {
  const q = normalizeText(query.trim());
  if (q.length < MIN_QUERY_LENGTH) return [];
  const hits: (ManualHit & { score: number })[] = [];
  for (const page of index) {
    const inTitle = page.foldedTitle.includes(q);
    const at = page.folded.indexOf(q);
    if (!inTitle && at < 0) continue;
    const start = Math.max(0, at < 0 ? 0 : at - SNIPPET_RADIUS);
    const end = Math.min(page.text.length, (at < 0 ? 0 : at) + q.length + SNIPPET_RADIUS);
    hits.push({
      slug: page.slug,
      title: page.title,
      snippet: `${start > 0 ? '…' : ''}${page.text.slice(start, end)}${end < page.text.length ? '…' : ''}`,
      score: inTitle ? 0 : 1,
    });
  }
  return hits.sort((a, b) => a.score - b.score).map(({ score: _score, ...hit }) => hit);
}
