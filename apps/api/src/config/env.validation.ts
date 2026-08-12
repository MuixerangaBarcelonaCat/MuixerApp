import * as Joi from 'joi';

/**
 * Validated at app bootstrap via ConfigModule.forRoot — a missing or malformed
 * required variable is a fatal startup error, not a silently-applied default
 * (ARCH-1 / SEC-1).
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),

  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.number().default(900),
  JWT_REFRESH_TTL_DASHBOARD: Joi.number().default(28800),
  JWT_REFRESH_TTL_PWA: Joi.number().default(604800),
  REFRESH_TOKEN_COOKIE: Joi.string().default('muixer_rt'),
  COOKIE_SECURE: Joi.string().valid('true', 'false').optional(),

  SETUP_TOKEN: Joi.string().allow('').optional(),

  ASSIGNMENT_LOCK_DAYS: Joi.number().default(2),

  LEGACY_API_URL: Joi.string().allow('').optional(),
  LEGACY_API_USERNAME: Joi.string().allow('').optional(),
  LEGACY_API_PASSWORD: Joi.string().allow('').optional(),

  MAIL_PROVIDER: Joi.string().valid('console', 'smtp').default('console'),
  // Required only when MAIL_PROVIDER=smtp — e.g. Google Workspace SMTP with an app password.
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().when('MAIL_PROVIDER', { is: 'smtp', then: Joi.required(), otherwise: Joi.optional() }),
  SMTP_PASS: Joi.string().when('MAIL_PROVIDER', { is: 'smtp', then: Joi.required(), otherwise: Joi.optional() }),
  MAIL_FROM_ADDRESS: Joi.string().when('MAIL_PROVIDER', { is: 'smtp', then: Joi.required(), otherwise: Joi.optional() }),
  MAIL_FROM_NAME: Joi.string().default('MuixerApp'),

  // Dashboard origin (no scheme) — used to build links in emails (password reset).
  // The scheme is derived from NODE_ENV (https in production, http otherwise).
  SITE_ADDRESS: Joi.string().default('localhost:4200'),
  PASSWORD_RESET_TTL: Joi.number().default(3600),

  // PWA origin (no scheme) — used to build member-activation invite links.
  PWA_SITE_ADDRESS: Joi.string().default('localhost:4300'),
  INVITE_TOKEN_TTL_HOURS: Joi.number().default(72),
});
