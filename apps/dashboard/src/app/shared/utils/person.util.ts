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
