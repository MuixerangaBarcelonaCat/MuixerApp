/** Composes the text shown for an assigned person, appending their node's climb indicator if set. */
export function formatAssignedLabel(alias: string, climbIndicator: string | null | undefined): string {
  return climbIndicator ? `${alias} (${climbIndicator})` : alias;
}

export function resolveAssignmentPersonLabel(person: {
  alias: string;
  name: string;
}): string {
  return person.alias.trim() || person.name.trim() || '—';
}
