export function getSmtpHost(): string {
  return process.env['SMTP_HOST'] ?? '';
}

export function getSmtpPort(): number {
  return parseInt(process.env['SMTP_PORT'] ?? '587', 10);
}

export function getSmtpUser(): string {
  return process.env['SMTP_USER'] ?? '';
}

export function getSmtpPass(): string {
  return process.env['SMTP_PASS'] ?? '';
}

export function getSmtpFrom(): string {
  return process.env['SMTP_FROM'] ?? 'MuixerApp <noreply@muixer.cat>';
}

export function getPwaBaseUrl(): string {
  return process.env['PWA_BASE_URL'] ?? 'http://localhost:4300';
}

export function getDashboardBaseUrl(): string {
  return process.env['DASHBOARD_BASE_URL'] ?? 'http://localhost:4200';
}

export function getPasswordResetTtlHours(): number {
  return parseInt(process.env['PASSWORD_RESET_TTL_HOURS'] ?? '1', 10);
}

export function isSmtpConfigured(): boolean {
  return Boolean(getSmtpHost() && getSmtpUser() && getSmtpPass());
}
