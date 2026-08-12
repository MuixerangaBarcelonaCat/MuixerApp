import { FormBuilder, Validators } from '@angular/forms';
import { CountryCode, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { Gender, PersonRegistrationData } from '@muixer/shared';

export const DEFAULT_COUNTRY: CountryCode = 'ES';

export type PersonDataFormGroup = ReturnType<typeof buildPersonDataFormGroup>;

/** Builds the shared personal-data control set used both by self-registration and dependent completion. */
export function buildPersonDataFormGroup(
  fb: FormBuilder['nonNullable'],
  prefill?: Partial<PersonRegistrationData>,
) {
  const { country, phoneNumber } = splitPhoneNumber(prefill?.phone ?? null);

  return fb.group({
    name: [prefill?.name ?? '', Validators.required],
    firstSurname: [prefill?.firstSurname ?? '', Validators.required],
    secondSurname: [prefill?.secondSurname ?? ''],
    gender: [prefill?.gender ?? ('' as Gender | ''), Validators.required],
    country: [country, Validators.required],
    phoneNumber: [phoneNumber, Validators.required],
    birthDate: [prefill?.birthDate ?? '', Validators.required],
  });
}

/** Combines a country code and a national number into a canonical E.164 string, or null if invalid. */
export function combinePhoneNumber(country: CountryCode, phoneNumber: string): string | null {
  const parsed = parsePhoneNumberFromString(phoneNumber, country);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/** Splits an E.164 phone string back into a country + national number pair for prefilling a form. */
export function splitPhoneNumber(phone: string | null): { country: CountryCode; phoneNumber: string } {
  if (!phone) return { country: DEFAULT_COUNTRY, phoneNumber: '' };

  const parsed = parsePhoneNumberFromString(phone);
  if (!parsed || !parsed.isValid() || !parsed.country) {
    return { country: DEFAULT_COUNTRY, phoneNumber: '' };
  }

  return { country: parsed.country, phoneNumber: parsed.nationalNumber };
}

/** Every ISO-3166 alpha-2 country with its dial code, for the country selector. */
export function getCountryOptions(): { code: CountryCode; callingCode: string; flag: string }[] {
  return getCountries().map((code) => ({
    code,
    callingCode: `+${getCountryCallingCode(code)}`,
    flag: countryCodeToFlagEmoji(code),
  }));
}

function countryCodeToFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}
