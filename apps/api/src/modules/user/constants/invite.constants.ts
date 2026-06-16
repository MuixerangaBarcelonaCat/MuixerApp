const DEFAULT_INVITE_COOLDOWN_MINUTES = 2;

export function getInviteCooldownMs(): number {
  const minutes = parseInt(
    process.env['INVITE_COOLDOWN_MINUTES'] ??
      String(DEFAULT_INVITE_COOLDOWN_MINUTES),
    10,
  );
  return Math.max(minutes, 1) * 60 * 1000;
}
