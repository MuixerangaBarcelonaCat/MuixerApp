/** Copyright holder shown in the «Sobre l'app» section of both apps. */
export const COPYRIGHT_HOLDER = 'Associació Muixeranga de Barcelona';

/** Public repository with the app's source code. */
export const SOURCE_CODE_URL = 'https://github.com/MuixerangaBarcelonaCat/MuixerApp';

const COPYRIGHT_START_YEAR = 2026;

/** `2026` while it is still 2026, then `2026–<currentYear>`. */
export function formatCopyrightYears(currentYear: number): string {
  return currentYear > COPYRIGHT_START_YEAR
    ? `${COPYRIGHT_START_YEAR}–${currentYear}`
    : `${COPYRIGHT_START_YEAR}`;
}
