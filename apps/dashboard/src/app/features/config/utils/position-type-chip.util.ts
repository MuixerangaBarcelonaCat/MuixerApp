import { BASE_POSITION_TYPE, DIRECTION_NODE_PRESETS, PINYA_NODE_PRESETS, TRONC_NODE_PRESETS } from '@muixer/shared';
import { positionTypeColor } from '@muixer/pinyes-render';

const LABELS: Record<string, string> = Object.fromEntries([
  ...TRONC_NODE_PRESETS.map((p) => [p.positionType, p.label]),
  ...PINYA_NODE_PRESETS.map((p) => [p.positionType as string, p.label]),
  ...DIRECTION_NODE_PRESETS.map((p) => [p.positionType, p.label]),
  [BASE_POSITION_TYPE, 'Base'],
]);

/** How a tag's position type shows as a chip: its preset label, in the type's canvas pencil tone. */
export function positionTypeChip(positionType: string): { label: string; color: string } {
  return { label: LABELS[positionType] ?? positionType, color: positionTypeColor(positionType) };
}
