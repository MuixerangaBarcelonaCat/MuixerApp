/** Composes the text shown for an assigned person, appending their node's climb indicator if set. */
export function formatAssignedLabel(alias: string, climbIndicator: string | null | undefined): string {
  return climbIndicator ? `${alias} (${climbIndicator})` : alias;
}
