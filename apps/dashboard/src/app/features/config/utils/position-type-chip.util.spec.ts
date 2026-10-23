import { describe, it, expect } from 'vitest';
import { positionTypeColor } from '@muixer/pinyes-render';
import { positionTypeChip } from './position-type-chip.util';

describe('positionTypeChip', () => {
  it('labels a preset position type with its preset label and colors it with its canvas pencil tone', () => {
    expect(positionTypeChip('vents')).toEqual({ label: 'VENT', color: positionTypeColor('vents') });
    expect(positionTypeChip('segona')).toEqual({ label: 'Segona', color: positionTypeColor('segona') });
    expect(positionTypeChip('direccio-xicalla')).toEqual({ label: 'Direcció xicalla', color: positionTypeColor('direccio-xicalla') });
  });

  it('labels the base «Base», in the neutral tone', () => {
    expect(positionTypeChip('base')).toEqual({ label: 'Base', color: positionTypeColor('base') });
  });

  it('shows an unknown position type as it is, in the neutral tone', () => {
    expect(positionTypeChip('not-a-type')).toEqual({ label: 'not-a-type', color: positionTypeColor('not-a-type') });
  });
});
