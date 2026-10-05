import { evaluateTagCompliance } from '@muixer/shared';
import { Person } from '../../../persons/models/person.model';

export type TaggingMode = 'pending' | 'all';

/** Mateixa regla mínima que el servidor (`tagRuleOk`), calculada al client. */
export function isTagCompliant(person: Pick<Person, 'positions'>): boolean {
  return evaluateTagCompliance(person.positions.map((tag) => tag.category)).ok;
}

/**
 * Mou el cursor `delta` posicions. Al mode `pending`, la persona que es deixa enrere s'elimina
 * de la cua si ja compleix la regla; la persona actual no es retira mai mentre es veu.
 */
export function advance(
  people: Person[],
  index: number,
  delta: 1 | -1,
  mode: TaggingMode,
): { people: Person[]; index: number } {
  const target = index + delta;
  if (target < 0 || target >= people.length) return { people, index };

  if (mode === 'pending' && isTagCompliant(people[index])) {
    return {
      people: people.filter((_, i) => i !== index),
      index: delta === 1 ? index : target,
    };
  }
  return { people, index: target };
}
