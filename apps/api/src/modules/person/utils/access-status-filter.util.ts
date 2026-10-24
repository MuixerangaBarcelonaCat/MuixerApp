import { SelectQueryBuilder } from 'typeorm';
import { AccessStatus } from '@muixer/shared';
import { Person } from '../person.entity';

const NO_OWN_ACCESS = `COALESCE(user.isActive, false) = false`;

const HAS_RESPONSIBLE = `EXISTS (
  SELECT 1 FROM person_delegates pd
  WHERE pd.person_id = person.id AND pd."isPrimary" AND pd."isActive"
)`;

const CONDITIONS: Record<AccessStatus, string> = {
  [AccessStatus.ACTIVE]: `user.isActive = true`,
  [AccessStatus.INVITED]: `${NO_OWN_ACCESS} AND user.inviteExpiresAt > :accessStatusNow`,
  [AccessStatus.INVITE_EXPIRED]: `${NO_OWN_ACCESS} AND user.inviteExpiresAt <= :accessStatusNow`,
  [AccessStatus.MANAGED]: `${NO_OWN_ACCESS} AND user.inviteExpiresAt IS NULL AND ${HAS_RESPONSIBLE}`,
  [AccessStatus.NONE]: `${NO_OWN_ACCESS} AND user.inviteExpiresAt IS NULL AND NOT ${HAS_RESPONSIBLE}`,
};

/**
 * «Accés a l'app» as a server-side filter, so it can paginate. Same precedence as
 * `resolveAccessStatus` in `@muixer/shared` (parity: `person-access-status.integration.spec.ts`).
 * Expects the person aliased `person` with `person.user` left-joined as `user`, as `findAll` does;
 * `now` comes from the caller so this and the TS rule read the same clock.
 */
export function applyAccessStatusFilter(
  qb: SelectQueryBuilder<Person>,
  status: AccessStatus,
  now: Date,
): void {
  qb.andWhere(`(${CONDITIONS[status]})`, { accessStatusNow: now });
}
