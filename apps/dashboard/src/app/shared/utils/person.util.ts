/**
 * Person-related utility functions
 */

import { AvailabilityStatus, OnboardingStatus } from '@muixer/shared';
import type { Person } from '../../features/persons/models/person.model';

/**
 * Obté el nom complet d'una persona
 * @param person Objecte persona
 * @returns Nom complet (nom + cognoms)
 */
export function getFullName(person: Person): string {
  return [person.name, person.firstSurname, person.secondSurname]
    .filter(Boolean)
    .join(' ');
}

/**
 * Obté l'etiqueta en català per a un estat de disponibilitat
 * @param status Estat de disponibilitat
 * @returns Etiqueta en català
 */
export function getAvailabilityLabel(status: AvailabilityStatus): string {
  const labels: Record<AvailabilityStatus, string> = {
    [AvailabilityStatus.AVAILABLE]: 'Disponible',
    [AvailabilityStatus.TEMPORARILY_UNAVAILABLE]: 'No disponible',
    [AvailabilityStatus.LONG_TERM_UNAVAILABLE]: 'Baixa llarga',
  };
  return labels[status] || status;
}

/**
 * Obté l'etiqueta en català per a un estat d'acollida
 * @param status Estat d'acollida
 * @returns Etiqueta en català
 */
export function getOnboardingLabel(status: OnboardingStatus): string {
  const labels: Record<OnboardingStatus, string> = {
    [OnboardingStatus.IN_PROGRESS]: 'En seguiment',
    [OnboardingStatus.COMPLETED]: 'Finalitzat',
    [OnboardingStatus.LOST]: 'Perdut',
    [OnboardingStatus.NOT_APPLICABLE]: 'No aplica',
  };
  return labels[status] || status;
}

/** Baseline (cm) for relative shoulder height display (+/- from this value). */
export const SHOULDER_HEIGHT_BASELINE_CM = 140;

/**
 * Absolute shoulder height for display (cm).
 */
export function formatShoulderHeightCm(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value} cm`;
}

/**
 * Relative offset from baseline (e.g. +10, -5, 0).
 */
export function formatShoulderHeightRelative(
  value: number | null | undefined,
  baselineCm = SHOULDER_HEIGHT_BASELINE_CM,
): string {
  if (value === null || value === undefined) {
    return '—';
  }
  const delta = value - baselineCm;
  if (delta === 0) {
    return '0';
  }
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export type ShoulderHeightTone = 'positive' | 'negative' | 'zero' | 'empty';

export function shoulderHeightRelativeTone(
  value: number | null | undefined,
  baselineCm = SHOULDER_HEIGHT_BASELINE_CM,
): ShoulderHeightTone {
  if (value === null || value === undefined) {
    return 'empty';
  }
  const delta = value - baselineCm;
  if (delta > 0) {
    return 'positive';
  }
  if (delta < 0) {
    return 'negative';
  }
  return 'zero';
}
