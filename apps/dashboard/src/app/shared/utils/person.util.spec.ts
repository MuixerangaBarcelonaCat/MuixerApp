import { AvailabilityStatus, OnboardingStatus } from '@muixer/shared';
import type { Person } from '../../features/persons/models/person.model';
import {
  formatShoulderHeightCm,
  formatShoulderHeightRelative,
  getAvailabilityLabel,
  getFullName,
  getOnboardingLabel,
  shoulderHeightRelativeTone,
  SHOULDER_HEIGHT_BASELINE_CM,
} from './person.util';

describe('person.util', () => {
  const basePerson: Person = {
    id: '1',
    name: 'Jo',
    firstSurname: 'Puig',
    secondSurname: null,
    alias: 'jo',
    email: null,
    phone: null,
    birthDate: null,
    shoulderHeight: 150,
    isXicalla: false,
    isMember: true,
    availability: AvailabilityStatus.AVAILABLE,
    onboardingStatus: OnboardingStatus.NOT_APPLICABLE,
    shirtDate: null,
    notes: null,
    isActive: true,
    positions: [],
    createdAt: '',
    updatedAt: '',
  };

  it('getFullName joins parts', () => {
    expect(getFullName(basePerson)).toBe('Jo Puig');
  });

  it('getAvailabilityLabel returns Catalan labels', () => {
    expect(getAvailabilityLabel(AvailabilityStatus.AVAILABLE)).toBe('Disponible');
  });

  it('getOnboardingLabel returns Catalan labels', () => {
    expect(getOnboardingLabel(OnboardingStatus.IN_PROGRESS)).toBe('En seguiment');
  });

  it('formatShoulderHeightCm shows cm', () => {
    expect(formatShoulderHeightCm(140)).toBe('140 cm');
    expect(formatShoulderHeightCm(null)).toBe('—');
  });

  it('formatShoulderHeightRelative uses baseline 140', () => {
    expect(formatShoulderHeightRelative(150, SHOULDER_HEIGHT_BASELINE_CM)).toBe('+10');
    expect(formatShoulderHeightRelative(135, SHOULDER_HEIGHT_BASELINE_CM)).toBe('-5');
    expect(formatShoulderHeightRelative(140, SHOULDER_HEIGHT_BASELINE_CM)).toBe('0');
    expect(formatShoulderHeightRelative(null)).toBe('—');
  });

  it('shoulderHeightRelativeTone classifies delta', () => {
    expect(shoulderHeightRelativeTone(150)).toBe('positive');
    expect(shoulderHeightRelativeTone(135)).toBe('negative');
    expect(shoulderHeightRelativeTone(140)).toBe('zero');
    expect(shoulderHeightRelativeTone(null)).toBe('empty');
  });
});
