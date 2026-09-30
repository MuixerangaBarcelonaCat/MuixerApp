import { AvailabilityStatus, OnboardingStatus, SHOULDER_HEIGHT_BASELINE_CM } from '@muixer/shared';
import type { Person } from '../../features/persons/models/person.model';
import {
  formatPhone,
  formatShoulderHeightCm,
  formatShoulderHeightRelative,
  getAvailabilityLabel,
  getFullName,
  getOnboardingLabel,
  shoulderHeightRelativeTone,
} from './person.util';

describe('person.util', () => {
  const basePerson: Person = {
    id: '1',
    name: 'Jo',
    firstSurname: 'Puig',
    secondSurname: null,
    alias: 'jo',
    phone: null,
    birthDate: null,
    shoulderHeight: 150,
    gender: null,
    isXicalla: false,
    isMember: true,
    availability: AvailabilityStatus.AVAILABLE,
    onboardingStatus: OnboardingStatus.NOT_APPLICABLE,
    shirtDate: null,
    notes: null,
    notesEmoji: null,
    isActive: true,
    positions: [],
    user: null,
    tagCompliance: { ok: true, missing: [] },
    attendedCount: 0,
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
    expect(formatShoulderHeightCm(SHOULDER_HEIGHT_BASELINE_CM)).toBe(`${SHOULDER_HEIGHT_BASELINE_CM} cm`);
    expect(formatShoulderHeightCm(null)).toBe('—');
  });

  it('formatShoulderHeightRelative uses baseline 140', () => {
    expect(formatShoulderHeightRelative(150, SHOULDER_HEIGHT_BASELINE_CM)).toBe('+10');
    expect(formatShoulderHeightRelative(135, SHOULDER_HEIGHT_BASELINE_CM)).toBe('-5');
    expect(formatShoulderHeightRelative(SHOULDER_HEIGHT_BASELINE_CM, SHOULDER_HEIGHT_BASELINE_CM)).toBe('0');
    expect(formatShoulderHeightRelative(null)).toBe('—');
  });

  it('shoulderHeightRelativeTone classifies delta', () => {
    expect(shoulderHeightRelativeTone(150)).toBe('positive');
    expect(shoulderHeightRelativeTone(135)).toBe('negative');
    expect(shoulderHeightRelativeTone(SHOULDER_HEIGHT_BASELINE_CM)).toBe('zero');
    expect(shoulderHeightRelativeTone(null)).toBe('empty');
  });

  describe('formatPhone', () => {
    it('hides the +34 (Spain) prefix', () => {
      expect(formatPhone('+34612345678')).toBe('612345678');
    });

    it('keeps the prefix of any other country', () => {
      expect(formatPhone('+33612345678')).toBe('+33612345678');
    });

    it('does not strip a "34" that is not the calling code', () => {
      expect(formatPhone('+44341234567')).toBe('+44341234567');
      expect(formatPhone('341234567')).toBe('341234567');
    });

    it('returns null for an empty phone', () => {
      expect(formatPhone(null)).toBeNull();
      expect(formatPhone('')).toBeNull();
    });
  });
});
