export const FIGURE_PALETTE = [
  '#ef4444', // red
  '#22c55e', // green
  '#3b82f6', // blue
  '#eab308', // yellow
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#d946ef', // magenta
  '#14b8a6', // teal
  '#f43f5e', // rose
];

export function getFigureColor(index: number): string {
  return FIGURE_PALETTE[index % FIGURE_PALETTE.length];
}
