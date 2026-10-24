import { AccessStatus } from '../enums/access-status.enum';
import { ACCESS_STATUS_LABELS, resolveAccessStatus } from './person-access.util';

const NOW = new Date('2026-10-24T10:00:00Z');
const LATER = '2026-10-30T10:00:00.000Z';
const EARLIER = '2026-10-20T10:00:00.000Z';

describe('resolveAccessStatus', () => {
  it('és ACTIVE quan el compte és actiu', () => {
    expect(
      resolveAccessStatus({ user: { isActive: true, inviteExpiresAt: null }, hasResponsible: false }, NOW),
    ).toBe(AccessStatus.ACTIVE);
  });

  it('és INVITED quan hi ha una invitació encara vigent', () => {
    expect(
      resolveAccessStatus({ user: { isActive: false, inviteExpiresAt: LATER }, hasResponsible: false }, NOW),
    ).toBe(AccessStatus.INVITED);
  });

  it('és INVITE_EXPIRED quan la invitació ja ha vençut', () => {
    expect(
      resolveAccessStatus({ user: { isActive: false, inviteExpiresAt: EARLIER }, hasResponsible: false }, NOW),
    ).toBe(AccessStatus.INVITE_EXPIRED);
  });

  it('tracta el venciment exacte com a vençut', () => {
    expect(
      resolveAccessStatus({ user: { isActive: false, inviteExpiresAt: NOW }, hasResponsible: false }, NOW),
    ).toBe(AccessStatus.INVITE_EXPIRED);
  });

  it('accepta el venciment com a Date', () => {
    expect(
      resolveAccessStatus(
        { user: { isActive: false, inviteExpiresAt: new Date(LATER) }, hasResponsible: false },
        NOW,
      ),
    ).toBe(AccessStatus.INVITED);
  });

  it('és MANAGED sense compte propi i amb persona responsable', () => {
    expect(resolveAccessStatus({ user: null, hasResponsible: true }, NOW)).toBe(AccessStatus.MANAGED);
  });

  it('és NONE sense compte ni persona responsable', () => {
    expect(resolveAccessStatus({ user: null, hasResponsible: false }, NOW)).toBe(AccessStatus.NONE);
  });

  // Compte-esborrany del sync legacy (o creat per a una persona responsable) sense cap invitació.
  it('és NONE amb un compte inactiu que mai no ha rebut invitació', () => {
    expect(
      resolveAccessStatus({ user: { isActive: false, inviteExpiresAt: null }, hasResponsible: false }, NOW),
    ).toBe(AccessStatus.NONE);
  });

  it('el compte propi té prioritat sobre la persona responsable', () => {
    expect(
      resolveAccessStatus({ user: { isActive: true, inviteExpiresAt: null }, hasResponsible: true }, NOW),
    ).toBe(AccessStatus.ACTIVE);
    expect(
      resolveAccessStatus({ user: { isActive: false, inviteExpiresAt: LATER }, hasResponsible: true }, NOW),
    ).toBe(AccessStatus.INVITED);
  });

  it('una invitació vençuda té prioritat sobre la persona responsable', () => {
    expect(
      resolveAccessStatus({ user: { isActive: false, inviteExpiresAt: EARLIER }, hasResponsible: true }, NOW),
    ).toBe(AccessStatus.INVITE_EXPIRED);
  });
});

describe('ACCESS_STATUS_LABELS', () => {
  it('té una etiqueta per a cada estat', () => {
    expect(ACCESS_STATUS_LABELS).toEqual({
      [AccessStatus.ACTIVE]: 'Compte actiu',
      [AccessStatus.INVITED]: 'Invitació enviada',
      [AccessStatus.INVITE_EXPIRED]: 'Invitació vençuda',
      [AccessStatus.MANAGED]: 'Amb responsable',
      [AccessStatus.NONE]: 'Sense accés',
    });
  });
});
