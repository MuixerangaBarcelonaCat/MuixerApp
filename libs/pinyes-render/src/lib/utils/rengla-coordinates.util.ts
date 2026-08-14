export interface StageTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Converts Konva stage-space coordinates to SVG pixel coordinates,
 * accounting for the stage's current pan and zoom.
 */
export function stageToScreen(
  nodeX: number,
  nodeY: number,
  transform: StageTransform,
): { x: number; y: number } {
  return {
    x: nodeX * transform.scaleX + transform.x,
    y: nodeY * transform.scaleY + transform.y,
  };
}

/**
 * Converts SVG pixel coordinates to Konva stage-space coordinates,
 * accounting for the stage's current pan and zoom.
 */
export function screenToStage(
  screenX: number,
  screenY: number,
  transform: StageTransform,
): { x: number; y: number } {
  const scaleX = transform.scaleX || 1;
  const scaleY = transform.scaleY || 1;
  return {
    x: (screenX - transform.x) / scaleX,
    y: (screenY - transform.y) / scaleY,
  };
}

/** Central position types that should NOT be assignable to rengles */
const CENTRAL_POSITION_TYPES = new Set([
  'agulla', 'crossa', 'contrafort'
]);

export function isCentralNode(positionType: string | null): boolean {
  return positionType !== null && CENTRAL_POSITION_TYPES.has(positionType);
}
