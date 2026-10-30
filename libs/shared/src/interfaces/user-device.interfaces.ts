import { ClientType } from '../enums/client-type.enum';

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
