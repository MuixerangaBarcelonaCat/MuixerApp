export const JWT_ACCESS_TTL = parseInt(process.env['JWT_ACCESS_TTL'] ?? '900', 10);
/** How long a password-reset token stays valid, in seconds (default 1h). */
export const PASSWORD_RESET_TTL = parseInt(process.env['PASSWORD_RESET_TTL'] ?? '3600', 10);
/** How long a member-activation invite link stays valid, in hours (default 72h). */
export const INVITE_TOKEN_TTL_HOURS = parseInt(process.env['INVITE_TOKEN_TTL_HOURS'] ?? '72', 10);
/**
 * How long an admin-generated recovery link stays valid, in hours (default 24h). Deliberately
 * longer than PASSWORD_RESET_TTL: that one is requested by the user, who is looking at their
 * inbox right now, while this one is forwarded over WhatsApp and may sit unread for a day.
 */
export const RECOVERY_LINK_TTL_HOURS = parseInt(process.env['RECOVERY_LINK_TTL_HOURS'] ?? '24', 10);
export const JWT_REFRESH_TTL_DASHBOARD = parseInt(process.env['JWT_REFRESH_TTL_DASHBOARD'] ?? '28800', 10);
export const JWT_REFRESH_TTL_PWA = parseInt(process.env['JWT_REFRESH_TTL_PWA'] ?? '604800', 10);
export const REFRESH_TOKEN_COOKIE = process.env['REFRESH_TOKEN_COOKIE'] ?? 'muixer_rt';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const IS_SSE_KEY = 'isSse';
