// ==============================================================================
// AssetVault: Structured Pino Logger with Redaction
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces zero-leakage of passwords, tokens, hashes, and authorization headers
// ==============================================================================

import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
      'authorization',
      'cookie',
      'password',
      'passwordHash',
      'password_hash',
      'token',
      'tokenHash',
      'token_hash',
      'refreshToken',
      'accessToken',
      'googleId',
      'google_id',
      'clientSecret',
      'client_secret',
      'licenseKey',
      'license_key',
      '*.password',
      '*.passwordHash',
      '*.password_hash',
      '*.token',
      '*.refreshToken',
      '*.licenseKey',
      '*.license_key',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
});

export default logger;
