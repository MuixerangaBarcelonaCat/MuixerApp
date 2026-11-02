import { ClientType } from '../enums/client-type.enum';
import { UserRole } from '../enums/user-role.enum';

/** An open session of a user account: one refresh-token family. */
export interface UserSession {
  family: string;
  clientType: ClientType;
  userAgent: string | null;
  startedAt: string;
  lastRefreshAt: string;
  expiresAt: string;
}

/** A device subscribed to push notifications (never exposes endpoint or keys). */
export interface UserPushDevice {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Invite state of an account: a link that still works, one that ran out, or none. */
export type UserInviteStatus = 'PENDING' | 'EXPIRED';

/** One row of the admin «Dispositius i sessions» list. */
export interface UserDevicesSummary {
  userId: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  person: { id: string; alias: string; name: string; firstSurname: string } | null;
  /** Refresh-token families with at least one usable token. */
  activeSessions: number;
  /** Active push subscriptions. */
  activeDevices: number;
  /** Last login or token refresh (the 15-min access token leaves no trace). */
  lastAccessAt: string | null;
  /** Last push delivered to any of the account's devices. */
  lastPushAt: string | null;
  invite: { status: UserInviteStatus; expiresAt: string } | null;
}
