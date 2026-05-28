export const RENGLA_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#14b8a6',
];

export function getRenglaColor(index: number): string {
  return RENGLA_COLORS[index % RENGLA_COLORS.length];
}
