/**
 * Date formatting utility functions
 */

/**
 * Formata una data en format català (dia mes any)
 * @param dateStr Data en format ISO string o null
 * @returns Data formatada o '-' si és null
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  
  const date = new Date(dateStr);
  return date.toLocaleDateString('ca-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formata una data i hora en format català
 * @param dateStr Data en format ISO string
 * @returns Data i hora formatades
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ca-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
