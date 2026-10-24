import { AccessStatus } from '../enums/access-status.enum';

export interface AccessStatusInputs {
  /** The person's own account, if any (an inactive one may be a stub that never got an invite). */
  user: { isActive: boolean; inviteExpiresAt: string | Date | null } | null;
  /** An active primary `PersonDelegate` exists: someone else manages this person. */
  hasResponsible: boolean;
}

/**
 * Access to the app, in precedence order: own account first (active, then a live invite, then an
 * expired one), then a responsible person, else none. Pure: the caller passes `now`.
 *
 * Mirror of `applyAccessStatusFilter()` in the API (`person/utils/access-status-filter.util.ts`);
 * `person-access-status.integration.spec.ts` keeps both in step.
 */
export function resolveAccessStatus({ user, hasResponsible }: AccessStatusInputs, now: Date): AccessStatus {
  if (user?.isActive) return AccessStatus.ACTIVE;
  if (user?.inviteExpiresAt != null) {
    return new Date(user.inviteExpiresAt).getTime() > now.getTime()
      ? AccessStatus.INVITED
      : AccessStatus.INVITE_EXPIRED;
  }
  return hasResponsible ? AccessStatus.MANAGED : AccessStatus.NONE;
}

export const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  [AccessStatus.ACTIVE]: 'Compte actiu',
  [AccessStatus.INVITED]: 'Invitació enviada',
  [AccessStatus.INVITE_EXPIRED]: 'Invitació vençuda',
  [AccessStatus.MANAGED]: 'Amb responsable',
  [AccessStatus.NONE]: 'Sense accés',
};
