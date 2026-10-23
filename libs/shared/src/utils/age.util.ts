/**
 * Age rules on date-only strings (`YYYY-MM-DD`). Pure: the caller passes "today" in the colla's
 * timezone, so the API and the dashboard can each use their own clock.
 *
 * Mirror of `xicallaSql()` in the API (`person/xicalla.sql.ts`); an integration spec keeps both
 * in step. A 29 February birthday counts on 1 March in non-leap years, as Postgres does.
 */

/** Completed years between `birthDate` and `today`. */
export function ageOn(birthDate: string, today: string): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const [year, month, day] = today.split('-').map(Number);
  const beforeBirthday = month < birthMonth || (month === birthMonth && day < birthDay);
  return year - birthYear - (beforeBirthday ? 1 : 0);
}

export interface XicallaInputs {
  birthDate: string | null;
  isXicallaManual: boolean;
}

/** Xicalla by age when the birth date is known; otherwise the flag set by hand. */
export function deriveIsXicalla(person: XicallaInputs, majorityAge: number, today: string): boolean {
  if (person.birthDate === null) return person.isXicallaManual;
  return ageOn(person.birthDate, today) < majorityAge;
}
