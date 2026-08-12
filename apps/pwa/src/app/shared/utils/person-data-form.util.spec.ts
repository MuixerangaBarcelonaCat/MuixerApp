import { FormBuilder } from '@angular/forms';
import { Gender } from '@muixer/shared';
import {
  buildPersonDataFormGroup,
  combinePhoneNumber,
  splitPhoneNumber,
  DEFAULT_COUNTRY,
} from './person-data-form.util';

describe('person-data-form.util', () => {
  describe('buildPersonDataFormGroup', () => {
    it('creates a group with all required fields invalid when empty', () => {
      const group = buildPersonDataFormGroup(new FormBuilder().nonNullable);

      expect(group.invalid).toBe(true);
      expect(group.controls.secondSurname.hasValidator).toBeDefined();
    });

    it('defaults the country to Spain', () => {
      const group = buildPersonDataFormGroup(new FormBuilder().nonNullable);
      expect(group.controls.country.value).toBe(DEFAULT_COUNTRY);
    });

    it('is valid once every mandatory field is filled (secondSurname stays optional)', () => {
      const group = buildPersonDataFormGroup(new FormBuilder().nonNullable);
      group.setValue({
        name: 'Joan',
        firstSurname: 'Garcia',
        secondSurname: '',
        gender: Gender.MALE,
        country: 'ES',
        phoneNumber: '612345678',
        birthDate: '2000-01-15',
      });

      expect(group.valid).toBe(true);
    });

    it('prefills from a partial PersonRegistrationData, splitting the E.164 phone', () => {
      const group = buildPersonDataFormGroup(new FormBuilder().nonNullable, {
        name: 'Joan',
        firstSurname: 'Garcia',
        secondSurname: 'Puig',
        gender: Gender.MALE,
        phone: '+34612345678',
        birthDate: '2000-01-15',
      });

      expect(group.controls.name.value).toBe('Joan');
      expect(group.controls.secondSurname.value).toBe('Puig');
      expect(group.controls.country.value).toBe('ES');
      expect(group.controls.phoneNumber.value).toBe('612345678');
    });

    it('falls back to the default country when the prefill phone does not parse', () => {
      const group = buildPersonDataFormGroup(new FormBuilder().nonNullable, {
        phone: 'not-a-real-number',
      } as never);

      expect(group.controls.country.value).toBe(DEFAULT_COUNTRY);
      expect(group.controls.phoneNumber.value).toBe('');
    });
  });

  describe('combinePhoneNumber', () => {
    it('combines a country and national number into E.164', () => {
      expect(combinePhoneNumber('ES', '612345678')).toBe('+34612345678');
    });

    it('returns null when the combination is not a valid number', () => {
      expect(combinePhoneNumber('ES', '123')).toBeNull();
    });
  });

  describe('splitPhoneNumber', () => {
    it('splits a valid E.164 number into country and national number', () => {
      expect(splitPhoneNumber('+34612345678')).toEqual({ country: 'ES', phoneNumber: '612345678' });
    });

    it('returns the default country with an empty number when it does not parse', () => {
      expect(splitPhoneNumber('garbage')).toEqual({ country: DEFAULT_COUNTRY, phoneNumber: '' });
    });

    it('returns the default country with an empty number for null input', () => {
      expect(splitPhoneNumber(null)).toEqual({ country: DEFAULT_COUNTRY, phoneNumber: '' });
    });
  });
});
