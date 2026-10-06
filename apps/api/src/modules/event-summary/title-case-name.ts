const BRACKETED = /(\([^)]*\))/;
const WORD_START = /(^|[\s\-'’])(\p{L})/gu;

/**
 * «PERSIANA» → «Persiana». Aliases are often stored in capitals, which reads as shouting in
 * print. Only all-caps names change — one typed with deliberate casing («MariaJo») is kept — and
 * text in brackets (direction markers «(X)», climb indicators) is never touched.
 */
export function titleCaseName(name: string): string {
  const parts = name.split(BRACKETED);
  const outside = parts.filter((part) => !BRACKETED.test(part)).join('');
  if (/\p{Ll}/u.test(outside) || !/\p{Lu}/u.test(outside)) return name;

  return parts
    .map((part) =>
      BRACKETED.test(part)
        ? part
        : part.toLocaleLowerCase('ca').replace(WORD_START, (_, before, letter) => before + letter.toLocaleUpperCase('ca')),
    )
    .join('');
}
