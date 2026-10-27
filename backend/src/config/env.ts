import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://mock:mock@localhost:5432/assetvault'),

  // JWT Configuration
  JWT_ACCESS_SECRET: z.string().default('assetvault-jwt-access-secret-minimum-32-chars-long!'),
  JWT_REFRESH_SECRET: z.string().default('assetvault-jwt-refresh-secret-minimum-32-chars-long!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_GRACE_WINDOW_MS: z.coerce.number().default(3000),
  COOKIE_SECRET: z.string().default('assetvault-cookie-secret-minimum-32-chars-long!'),

  // Google OAuth Credentials
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/v1/auth/google/callback'),

  // CORS and Security Limits
  CLIENT_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DIRECT_URL: z.string().optional(),
  MIGRATE_DATABASE_URL: z.string().optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).optional(),
  COOKIE_DOMAIN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX: z.string().default('100').transform((val) => parseInt(val, 10)),

  // SMTP Email Settings
  SMTP_HOST: z.string().default('smtp.ethereal.email'),
  SMTP_PORT: z.string().default('587').transform((val) => parseInt(val, 10)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('AssetVault <notifications@assetvault.io>'),
  SMTP_SECURE: z.string().default('false').transform((val) => val === 'true'),

  // Observability & Metrics
  METRICS_BEARER_TOKEN: z.string().default('assetvault-metrics-token-2026'),

  // Configurable default license auto-renewal extension period in days
  DEFAULT_AUTO_RENEW_PERIOD_DAYS: z.coerce.number().default(365),
  AUTO_RENEW_DEFAULT_DAYS: z.coerce.number().optional(),

  // Background Worker Execution (authoritative flag: defaults to false so API does not start duplicate cron jobs)
  ENABLE_IN_PROCESS_WORKER: z
    .string()
    .default(process.env.RUN_WORKER_IN_API ?? 'false')
    .transform((val) => val === 'true'),
  RUN_WORKER_IN_API: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ FATAL: Invalid environment variable configuration:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  if (
    result.data.NODE_ENV === 'production' &&
    (!process.env.METRICS_BEARER_TOKEN ||
      result.data.METRICS_BEARER_TOKEN === 'assetvault-metrics-token-2026')
  ) {
    console.error('❌ FATAL: Set a unique METRICS_BEARER_TOKEN in production; the development default is not allowed.');
    process.exit(1);
  }

  if (
    result.data.NODE_ENV === 'production' &&
    result.data.GOOGLE_CLIENT_ID &&
    result.data.GOOGLE_CLIENT_SECRET &&
    new URL(result.data.GOOGLE_CALLBACK_URL).hostname === 'localhost'
  ) {
    console.error('❌ FATAL: Configure GOOGLE_CALLBACK_URL for the deployed HTTPS callback when Google OAuth is enabled in production.');
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
