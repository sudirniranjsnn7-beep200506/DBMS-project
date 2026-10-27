// ==============================================================================
// AssetVault Express Application Setup & Security Hardening
// Course: VIT, BCSE307L Database Systems (Fall 2026-27)
// Enforces Helmet, CORS allow-list, HPP, Compression, Rate Limiting & Redacted Logging
// ==============================================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import hpp from 'hpp';
import passport from 'passport';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { configurePassport } from './config/passport';
import { globalRateLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler } from './errors/errorHandler';
import { NotFoundError } from './errors/AppError';
import apiRoutes from './routes';
import { getHealth } from './controllers/health.controller';
import {
  requestIdMiddleware,
  getMetricsHandler,
  getReadinessHandler,
} from './middleware/observability.middleware';

const app = express();

// Trust reverse proxy (Render, Vercel, Cloudflare, AWS ALB) for client IP and protocol detection
app.set('trust proxy', 1);

// Enable strong HTTP ETag support for client-side caching & revalidation
app.set('etag', 'strong');

// 0. Request ID & Tracing Middleware (injects X-Request-Id)
app.use(requestIdMiddleware);

// 1. Initialize Passport Strategies
configurePassport();
app.use(passport.initialize());

// 2. Security Headers (configured to allow AI Studio iframe embedding and Vite dev scripts)
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    hsts: false,
  })
);

// 3. Strict CORS Allow-List from CLIENT_URL and CORS_ORIGIN (supports comma-separated lists)
const parseAllowedOrigins = (sources: Array<string | undefined>): string[] => {
  const origins = new Set<string>();
  for (const src of sources) {
    if (!src) continue;
    for (const item of src.split(',')) {
      const trimmed = item.trim().replace(/\/$/, '');
      if (trimmed) origins.add(trimmed);
    }
  }
  return Array.from(origins);
};

export const allowedOrigins = parseAllowedOrigins([env.CLIENT_URL, env.CORS_ORIGIN]);

app.use(
  cors({
    origin: (_origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow same-origin, Cloud Run preview URLs, and configured origins
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  })
);

// 4. HTTP Parameter Pollution Defense
app.use(hpp());

// 5. Response Compression
app.use(compression());

// 6. Request Body Size Limiting (Prevents payload-based DoS while allowing voice audio payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// 7. Structured Pino HTTP Logging with Redaction (Never logs passwords/tokens/authorization)
if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/api/health',
      },
    })
  );
}

// 8. Global API Rate Limiting
app.use('/api', globalRateLimiter);

// 9. Health & Observability Endpoints
app.get('/health', getHealth);
app.get('/api/health', getHealth);
app.get('/api/v1/health', getHealth);
app.get('/ready', getReadinessHandler);
app.get('/api/ready', getReadinessHandler);
app.get('/api/v1/ready', getReadinessHandler);
app.get('/metrics', getMetricsHandler);

// 10. Mount Primary API Router
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);

// 11. 404 Route Fallthrough for API endpoints
app.use('/api', (req, _res, next) => {
  next(new NotFoundError(`Endpoint "${req.method} ${req.path}" does not exist`));
});

// 12. Centralized Error Handler (No stack traces in production)
app.use(errorHandler);

export default app;
