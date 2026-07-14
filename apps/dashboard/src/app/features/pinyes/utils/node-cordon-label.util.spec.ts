import { describe, it, expect } from 'vitest';
import { formatNodeCordonLabel } from './node-cordon-label.util';

describe('formatNodeCordonLabel', () => {
  it('appends the cordon number to the label', () => {
    expect(formatNodeCordonLabel('Mans', 2)).toBe('Mans C2');
  });

  it('returns the plain label when cordon is null', () => {
    expect(formatNodeCordonLabel('Mans', null)).toBe('Mans');
  });

  it('returns the plain label when cordon is undefined', () => {
    expect(formatNodeCordonLabel('Mans', undefined)).toBe('Mans');
  });
});
