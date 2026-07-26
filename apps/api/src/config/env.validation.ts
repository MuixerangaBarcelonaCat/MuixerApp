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
});
