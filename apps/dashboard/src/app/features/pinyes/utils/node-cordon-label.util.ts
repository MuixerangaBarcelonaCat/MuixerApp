/** Appends the cordon number to a node label, e.g. "Mans" + 2 → "Mans C2". */
export function formatNodeCordonLabel(label: string, cordon: number | null | undefined): string {
  return cordon != null ? `${label} C${cordon}` : label;
}
