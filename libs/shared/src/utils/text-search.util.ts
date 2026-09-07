/**
 * Free-text search helpers shared by every "type a name, filter a list" UI (person search,
 * participant pickers, sync matching, …): a query and the values it's matched against should
 * both ignore case and accents — «angela» must find «Àngela», and vice versa.
 */

/** Every combining diacritical mark in the Unicode "Combining Diacritical Marks" block — built
 *  from code points (768–879) rather than a regex literal, which editors/diffs tend to collapse
 *  into the literal characters themselves. Stripped after NFD decomposition below. */
const COMBINING_MARKS_START = 768;
const COMBINING_MARKS_END = 879;

/** Lowercased, accent-stripped form of `value`, for comparing free text case/accent-insensitively. */
export function normalizeForSearch(value: string): string {
  return Array.from(value.normalize('NFD'))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < COMBINING_MARKS_START || code > COMBINING_MARKS_END;
    })
    .join('')
    .toLowerCase();
}

/** Whether `value` contains `query` as a substring, ignoring case and accents on both sides. An
 *  empty (or all-whitespace) `query` matches everything — the "no filter typed yet" state. */
export function matchesSearch(value: string, query: string): boolean {
  const q = normalizeForSearch(query.trim());
  return q === '' || normalizeForSearch(value).includes(q);
}
